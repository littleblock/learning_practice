import { z } from "zod";

import type { QuestionImportSchemaSummary } from "@/shared/types/domain";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";

const aiSchemaSummarySchema = z.object({
  headerRowCount: z.coerce.number().int().min(1).max(5),
  questionTypeColumn: z.coerce.number().int().min(0).nullable(),
  stemColumn: z.coerce.number().int().min(0).nullable(),
  optionColumns: z.array(z.coerce.number().int().min(0)).min(2).max(6),
  answerColumn: z.coerce.number().int().min(0).nullable(),
  analysisColumn: z.coerce.number().int().min(0).nullable().optional(),
  lawSourceColumn: z.coerce.number().int().min(0).nullable().optional(),
  ignoredColumns: z.array(z.coerce.number().int().min(0)).default([]),
  answerEncoding: z
    .enum(["LETTER", "NUMERIC_INDEX", "JUDGE_TEXT"])
    .nullable(),
});

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>
        | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

const schemaPreviewRowLimit = 8;
const schemaPreviewValueLimit = 80;
const schemaPreviewSampleLimit = 5;

function truncatePreviewValue(value: string) {
  const normalized = value.trim();
  if (normalized.length <= schemaPreviewValueLimit) {
    return normalized;
  }

  return `${normalized.slice(0, schemaPreviewValueLimit)}...`;
}

function normalizePreviewToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[()（）]/g, "")
    .replace(/[:：]/g, "")
    .replace(/[\s_-]+/g, "");
}

function looksLikeQuestionTypeValue(value: string) {
  return [
    "single",
    "singlechoice",
    "单选",
    "单选题",
    "单项选择",
    "multiple",
    "multiplechoice",
    "多选",
    "多选题",
    "多项选择",
    "judge",
    "truefalse",
    "boolean",
    "判断",
    "判断题",
  ].includes(normalizePreviewToken(value));
}

function isAnswerLetterValue(value: string) {
  return /^[A-F](?:[\s,，、/]+[A-F])*$/i.test(value.trim());
}

function isAnswerNumericValue(value: string) {
  return /^\d(?:[\s,，、/]+\d)*$/.test(value.trim());
}

function isJudgeAnswerValue(value: string) {
  return [
    "对",
    "正确",
    "是",
    "true",
    "yes",
    "y",
    "错",
    "错误",
    "否",
    "false",
    "no",
    "n",
  ].includes(normalizePreviewToken(value));
}

function looksLikeLawSourceValue(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 255) {
    return false;
  }

  return (
    /第.{1,10}条/.test(normalized) ||
    /(条例|办法|规定|细则|规范)$/.test(normalized)
  );
}

function extractJsonPayload(content: string) {
  const trimmedContent = content.trim();
  if (
    (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) ||
    (trimmedContent.startsWith("[") && trimmedContent.endsWith("]"))
  ) {
    return trimmedContent;
  }

  const fencedMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmedContent.indexOf("{");
  const objectEnd = trimmedContent.lastIndexOf("}");
  const arrayStart = trimmedContent.indexOf("[");
  const arrayEnd = trimmedContent.lastIndexOf("]");

  if (
    objectStart >= 0 &&
    objectEnd > objectStart &&
    (arrayStart < 0 || objectStart < arrayStart) &&
    (arrayEnd < 0 || objectEnd > arrayEnd)
  ) {
    return trimmedContent.slice(objectStart, objectEnd + 1);
  }

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmedContent.slice(arrayStart, arrayEnd + 1);
  }

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmedContent.slice(objectStart, objectEnd + 1);
  }

  throw new Error("AI 返回内容中未找到可解析的 JSON");
}

function normalizeMessageContent(
  content:
    | string
    | Array<{
        text?: string;
        type?: string;
      }>
    | null
    | undefined,
) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function normalizeSchemaDetectionError(error: unknown, timeoutMs: number) {
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message === "This operation was aborted")
  ) {
    return new Error(`AI 列语义识别请求超时（${timeoutMs}ms）`);
  }

  return error instanceof Error ? error : new Error("AI 列语义识别失败");
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSchemaDetectionPreview(
  rows: Array<{
    rowNumber: number;
    values: string[];
  }>,
) {
  const previewRows = rows.slice(0, schemaPreviewRowLimit).map((row) => ({
    rowNumber: row.rowNumber,
    values: row.values.map((value) => truncatePreviewValue(value)),
  }));
  const columnCount = previewRows.reduce(
    (maxValue, row) => Math.max(maxValue, row.values.length),
    0,
  );

  return {
    rowCount: rows.length,
    previewRows,
    columns: Array.from({ length: columnCount }, (_, columnIndex) => {
      const sampleValues = Array.from(
        new Set(
          previewRows
            .map((row) => row.values[columnIndex] ?? "")
            .filter(Boolean)
            .slice(0, schemaPreviewSampleLimit),
        ),
      );
      const nonEmptyValues = rows
        .map((row) => String(row.values[columnIndex] ?? "").trim())
        .filter(Boolean);

      return {
        columnIndex,
        sampleValues,
        nonEmptyCount: nonEmptyValues.length,
        longTextCount: nonEmptyValues.filter((value) => value.length >= 12).length,
        questionTypeLikeCount: nonEmptyValues.filter(looksLikeQuestionTypeValue)
          .length,
        answerLetterLikeCount: nonEmptyValues.filter(isAnswerLetterValue).length,
        answerNumericLikeCount: nonEmptyValues.filter(isAnswerNumericValue).length,
        judgeAnswerLikeCount: nonEmptyValues.filter(isJudgeAnswerValue).length,
        lawSourceLikeCount: nonEmptyValues.filter(looksLikeLawSourceValue).length,
      };
    }),
  };
}

function assertQuestionImportAiConfigured() {
  const env = getServerEnv();

  if (!env.AI_SPLIT_API_KEY) {
    throw new Error("未配置 AI_SPLIT_API_KEY，无法执行 AI 列语义识别");
  }
}

/**
 * 功能说明：
 * 借助大模型识别整份 Excel 的列语义，只返回 schema，不直接返回题目草稿。
 *
 * 业务背景：
 * 当本地规则无法稳定识别非标准 Excel 的列含义时，需要模型辅助判断题型列、题干列、答案列和忽略列，
 * 但真正的题目归一化和校验仍然必须由后端固定逻辑执行。
 *
 * 核心逻辑：
 * 只向模型发送压缩后的表头、多行样本和列分布摘要，请求其返回零基列索引的 schema JSON，再交给本地校验器确认是否稳定。
 *
 * 关键约束：
 * 模型输出只能包含整批 schema 的受限字段，不允许返回动态规则、代码或题目草稿。
 */
export async function detectQuestionImportSchemaWithAi(
  rows: Array<{
    rowNumber: number;
    values: string[];
  }>,
): Promise<QuestionImportSchemaSummary> {
  assertQuestionImportAiConfigured();
  const env = getServerEnv();
  const requestTimeoutMs = Math.max(env.AI_SPLIT_TIMEOUT_MS, 180000);
  const preview = buildSchemaDetectionPreview(rows);
  const requestBody = {
    model: env.AI_SPLIT_MODEL,
    temperature: 0.1,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content: [
          "你是 Excel 题库结构识别助手。",
          "请只识别整份表格的列语义，不要生成题目。",
          "系统提供的是压缩后的表头、样本行和列分布摘要，不是整份文件。",
          "请只返回 JSON，不要输出解释、前后缀或 Markdown。",
          "所有列索引都必须使用从 0 开始的零基索引。",
          "返回字段只能包含：headerRowCount、questionTypeColumn、stemColumn、optionColumns、answerColumn、analysisColumn、lawSourceColumn、ignoredColumns、answerEncoding。",
          "answerEncoding 只能是 LETTER、NUMERIC_INDEX、JUDGE_TEXT 或 null。",
          "适用资格类别、资格类别、无关分类等列必须放入 ignoredColumns。",
        ].join(""),
      },
      {
        role: "user",
        content: [
          "请根据以下 Excel 样本摘要识别统一 schema。",
          "样本 JSON：",
          JSON.stringify(preview),
        ].join("\n\n"),
      },
    ],
  };

  for (let attempt = 1; attempt <= env.AI_SPLIT_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    const requestStartedAt = Date.now();

    try {
      const response = await fetch(
        `${env.AI_SPLIT_BASE_URL.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.AI_SPLIT_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      const rawText = await response.text();
      const payload = rawText
        ? (JSON.parse(rawText) as ChatCompletionResponse)
        : ({} as ChatCompletionResponse);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ||
            `AI schema 识别调用失败：${response.status} ${response.statusText}`,
        );
      }

      const content = normalizeMessageContent(
        payload.choices?.[0]?.message?.content,
      );
      if (!content) {
        throw new Error("AI schema 识别未返回有效内容");
      }

      const parsedSummary = aiSchemaSummarySchema.parse(
        JSON.parse(extractJsonPayload(content)),
      );

      logger.info(
        {
          attempt,
          rowCount: rows.length,
          previewRowCount: preview.previewRows.length,
          columnCount: preview.columns.length,
          previewBytes: JSON.stringify(preview).length,
          durationMs: Date.now() - requestStartedAt,
          timeoutMs: requestTimeoutMs,
          model: env.AI_SPLIT_MODEL,
        },
        "AI schema 识别完成",
      );

      return {
        headerRowCount: parsedSummary.headerRowCount,
        questionTypeColumn: parsedSummary.questionTypeColumn ?? null,
        stemColumn: parsedSummary.stemColumn ?? null,
        optionColumns: parsedSummary.optionColumns,
        answerColumn: parsedSummary.answerColumn ?? null,
        analysisColumn: parsedSummary.analysisColumn ?? null,
        lawSourceColumn: parsedSummary.lawSourceColumn ?? null,
        ignoredColumns: parsedSummary.ignoredColumns,
        answerEncoding: parsedSummary.answerEncoding ?? null,
      } satisfies QuestionImportSchemaSummary;
    } catch (error) {
      const normalizedError = normalizeSchemaDetectionError(
        error,
        requestTimeoutMs,
      );
      logger.error(
        {
          attempt,
          rowCount: rows.length,
          previewRowCount: preview.previewRows.length,
          columnCount: preview.columns.length,
          previewBytes: JSON.stringify(preview).length,
          durationMs: Date.now() - requestStartedAt,
          timeoutMs: requestTimeoutMs,
          model: env.AI_SPLIT_MODEL,
          error: serializeError(normalizedError),
        },
        "AI schema 识别失败",
      );

      if (attempt === env.AI_SPLIT_MAX_RETRIES) {
        throw normalizedError;
      }

      await delay(Math.min(1000 * attempt, 3000));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("AI schema 识别失败");
}

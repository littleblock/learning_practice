import { QuestionType } from "@prisma/client";
import { z } from "zod";

import {
  questionImportDraftSchema,
  type QuestionImportDraftInput,
} from "@/shared/schemas/question";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";

export interface AiSourceRowInput {
  rowNumber: number;
  content: string;
}

const aiQuestionOptionInputSchema = z.union([
  z.string().trim().min(1),
  z.object({
    label: z.string().trim().min(1).nullable().optional(),
    text: z.string().trim().min(1).nullable().optional(),
  }),
]);

const aiQuestionDraftSchema = z.object({
  type: z.union([
    z.nativeEnum(QuestionType),
    z.enum(["single", "multiple", "judge"]),
  ]),
  stem: z.string().trim().min(5),
  options: z.array(aiQuestionOptionInputSchema).min(2),
  correctAnswers: z
    .array(z.union([z.string().trim().min(1), z.number().int().min(1).max(26)]))
    .min(1),
  analysis: z.string().trim().nullable().optional(),
  lawSource: z.string().trim().nullable().optional(),
  sortOrder: z
    .union([z.number().int().min(1), z.string().trim().min(1)])
    .optional(),
  sourceLabel: z.string().trim().nullable().optional(),
  sourceContent: z.string().trim().nullable().optional(),
  sourceRowNumbers: z
    .array(z.union([z.number().int().min(1), z.string().trim().min(1)]))
    .min(1),
});

const aiQuestionDraftEnvelopeSchema = z.union([
  z.array(aiQuestionDraftSchema),
  z.object({
    questions: z.array(aiQuestionDraftSchema),
  }),
]);

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

function normalizeAiQuestionType(
  value: z.infer<typeof aiQuestionDraftSchema>["type"],
) {
  if (value === "single") {
    return QuestionType.SINGLE;
  }

  if (value === "multiple") {
    return QuestionType.MULTIPLE;
  }

  if (value === "judge") {
    return QuestionType.JUDGE;
  }

  return value;
}

function extractJsonPayload(content: string) {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const arrayStart = content.indexOf("[");
  const arrayEnd = content.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return content.slice(arrayStart, arrayEnd + 1);
  }

  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    return content.slice(objectStart, objectEnd + 1);
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

function normalizeFetchError(error: unknown, timeoutMs: number) {
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.message === "This operation was aborted")
  ) {
    return new Error(`AI 拆题请求超时（${timeoutMs}ms）`);
  }

  return error instanceof Error ? error : new Error("AI 拆题失败");
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

function formatSourceRowLabel(sourceRowNumbers: number[]) {
  const numbers = Array.from(new Set(sourceRowNumbers)).sort(
    (left, right) => left - right,
  );
  if (numbers.length === 1) {
    return `第 ${numbers[0]} 行`;
  }

  return `第 ${numbers[0]}-${numbers[numbers.length - 1]} 行`;
}

function buildChunkText(rows: AiSourceRowInput[]) {
  return rows
    .map((row) => `第 ${row.rowNumber} 行 | ${row.content}`)
    .join("\n");
}

function normalizeOptionLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function stripOptionPrefix(value: string) {
  return value
    .trim()
    .replace(/^[A-Fa-f]\s*[.、:：）)]\s*/, "")
    .trim();
}

function normalizeOptionList(
  options: z.infer<typeof aiQuestionDraftSchema>["options"],
) {
  return options.map((option, index) => {
    if (typeof option === "string") {
      return {
        label: normalizeOptionLabel(index),
        text: stripOptionPrefix(option),
      };
    }

    const fallbackLabel = normalizeOptionLabel(index);
    const label = option.label?.trim().toUpperCase() || fallbackLabel;
    const text = stripOptionPrefix(
      option.text?.trim() || option.label?.trim() || "",
    );

    if (!text) {
      throw new Error("AI 返回的选项内容为空");
    }

    return {
      label,
      text,
    };
  });
}

function normalizeAnswerToken(value: string | number) {
  if (typeof value === "number") {
    return normalizeOptionLabel(value - 1);
  }

  const normalized = value.trim().toUpperCase();
  if (/^\d+$/.test(normalized)) {
    const numericValue = Number(normalized);
    if (numericValue >= 1 && numericValue <= 26) {
      return normalizeOptionLabel(numericValue - 1);
    }
  }

  return normalized.replace(/[^A-Z]/g, "");
}

function normalizeSourceRowNumbers(
  sourceRowNumbers: Array<string | number>,
  allowedRowNumbers: Set<number>,
) {
  return Array.from(
    new Set(
      sourceRowNumbers
        .map((rowNumber) => Number(rowNumber))
        .filter((rowNumber) => Number.isInteger(rowNumber) && rowNumber > 0)
        .filter((rowNumber) => allowedRowNumbers.has(rowNumber)),
    ),
  ).sort((left, right) => left - right);
}

export function isAiRateLimitError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /429|rate limit|limit exceeded|限流|并发/.test(
    error.message.toLowerCase(),
  );
}

function normalizeSortOrderValue(
  value: z.infer<typeof aiQuestionDraftSchema>["sortOrder"],
  fallbackSortOrder: number,
) {
  if (typeof value === "number") {
    return value >= fallbackSortOrder ? value : fallbackSortOrder;
  }

  if (typeof value === "string") {
    const matched = value.match(/\d+/);
    const parsed = matched ? Number.parseInt(matched[0], 10) : Number.NaN;
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed >= fallbackSortOrder ? parsed : fallbackSortOrder;
    }
  }

  return fallbackSortOrder;
}

function normalizeQuestionDrafts(
  payload: z.infer<typeof aiQuestionDraftEnvelopeSchema>,
  rows: AiSourceRowInput[],
  startingSortOrder: number,
) {
  const drafts = Array.isArray(payload) ? payload : payload.questions;
  const allowedRowNumbers = new Set(rows.map((row) => row.rowNumber));
  const fallbackSourceContent = buildChunkText(rows);
  let nextSortOrder = startingSortOrder;

  return drafts.map((draft) => {
    const sourceRowNumbers = normalizeSourceRowNumbers(
      draft.sourceRowNumbers,
      allowedRowNumbers,
    );

    if (sourceRowNumbers.length === 0) {
      throw new Error("AI 返回的题目未关联当前分块中的有效行号");
    }

    const options = normalizeOptionList(draft.options);
    const optionLabels = new Set(options.map((item) => item.label));
    const correctAnswers = Array.from(
      new Set(
        draft.correctAnswers
          .map(normalizeAnswerToken)
          .filter((answer) => optionLabels.has(answer)),
      ),
    );

    if (correctAnswers.length === 0) {
      throw new Error("AI 返回的正确答案无法匹配到选项");
    }

    const sortOrder = normalizeSortOrderValue(draft.sortOrder, nextSortOrder);
    nextSortOrder = Math.max(nextSortOrder, sortOrder) + 1;

    return questionImportDraftSchema.parse({
      type: normalizeAiQuestionType(draft.type),
      stem: draft.stem,
      options,
      correctAnswers,
      analysis: draft.analysis ?? null,
      lawSource: draft.lawSource ?? null,
      sortOrder,
      sourceLabel: draft.sourceLabel || formatSourceRowLabel(sourceRowNumbers),
      sourceContent: draft.sourceContent || fallbackSourceContent,
      sourceRowNumbers,
    }) satisfies QuestionImportDraftInput;
  });
}

export function assertQuestionSplitConfigured() {
  const env = getServerEnv();

  if (!env.AI_SPLIT_API_KEY) {
    throw new Error("未配置 AI_SPLIT_API_KEY，无法执行 AI 拆题");
  }
}

/**
 * 功能说明：
 * 调用大模型识别非标准 Excel 行内容，并输出可确认入库的题目草稿。
 *
 * 业务背景：
 * 非标准模板导题无法稳定依赖表头规则，需要容忍模型在选项和答案字段上的轻微格式偏差。
 *
 * 核心逻辑：
 * 将带行号的原始内容发送给 OpenAI 兼容接口，请求模型返回 JSON，再由本地逻辑兼容解析字符串选项、数字答案和缺省标签。
 *
 * 关键约束：
 * 每道题必须保留有效来源行号，且正确答案最终必须落在本地归一化后的选项范围内，否则该分块会被判为失败。
 */
export async function splitQuestionsWithAi(
  rows: AiSourceRowInput[],
  startingSortOrder: number,
): Promise<QuestionImportDraftInput[]> {
  assertQuestionSplitConfigured();
  const env = getServerEnv();
  const chunkText = buildChunkText(rows);
  const requestTimeoutMs =
    rows.length === 1
      ? Math.max(env.AI_SPLIT_TIMEOUT_MS, 90000)
      : env.AI_SPLIT_TIMEOUT_MS;
  const maxTokens = rows.length === 1 ? 1024 : 4096;

  const requestBody = {
    model: env.AI_SPLIT_MODEL,
    temperature: 0.1,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content: [
          "你是题库导入助手。",
          "请根据带行号的 Excel 原始内容识别可以纳入题库的题目。",
          "只返回 JSON，不要输出解释、前后缀或 Markdown。",
          '返回格式必须是数组或 {"questions": [...]}。',
          "每道题只允许包含字段：type、stem、options、correctAnswers、analysis、lawSource、sortOrder、sourceLabel、sourceContent、sourceRowNumbers。",
          "type 只能是 single、multiple、judge。",
          'options 优先返回 [{"label":"A","text":"选项内容"}]，不要只返回字符串数组。',
          'correctAnswers 必须返回选项标识数组，例如 ["A"] 或 ["A", "C"]。',
          "sourceRowNumbers 必须填写实际使用到的原始行号数组。",
          "如果某些行不能形成完整题目，直接忽略，不要输出占位记录。",
        ].join(""),
      },
      {
        role: "user",
        content: [
          "请从以下内容中识别题目，并保持原始顺序。",
          "原始内容如下：",
          chunkText,
        ].join("\n\n"),
      },
    ],
  };

  for (let attempt = 1; attempt <= env.AI_SPLIT_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

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
            `AI 拆题调用失败：${response.status} ${response.statusText}`,
        );
      }

      const content = normalizeMessageContent(
        payload.choices?.[0]?.message?.content,
      );
      if (!content) {
        throw new Error("AI 拆题未返回有效内容");
      }

      const parsed = aiQuestionDraftEnvelopeSchema.parse(
        JSON.parse(extractJsonPayload(content)),
      );
      return normalizeQuestionDrafts(parsed, rows, startingSortOrder);
    } catch (error) {
      const normalizedError = normalizeFetchError(error, requestTimeoutMs);
      logger.error(
        {
          attempt,
          rowCount: rows.length,
          chunkLength: chunkText.length,
          error: serializeError(normalizedError),
        },
        "AI 拆题失败",
      );

      if (
        normalizedError instanceof Error &&
        normalizedError.message.includes("请求超时")
      ) {
        throw normalizedError;
      }

      if (attempt === env.AI_SPLIT_MAX_RETRIES) {
        throw normalizedError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("AI 拆题失败");
}

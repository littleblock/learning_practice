import { QuestionImportTemplateType } from "@prisma/client";

import {
  questionImportDraftSchema,
  questionImportRowSchema,
  type QuestionImportDraftInput,
} from "@/shared/schemas/question";
import type { QuestionImportSchemaSummary } from "@/shared/types/domain";
import { detectQuestionImportSchemaWithAi } from "@/server/services/question-import-ai-service";
import {
  looksLikeLawSource,
  mapImportRowToQuestionInput,
  normalizeImportQuestionTypeValue,
  normalizeQuestionInput,
} from "@/server/services/question-payload";

export interface ImportSchemaSheetRow {
  rowNumber: number;
  values: string[];
  content: string;
}

export interface StructuredSchemaFailedRow {
  rowNumber: number;
  content: string;
  reason: string;
}

export interface DetectedQuestionImportSchema {
  mode: "STANDARD" | "HEURISTIC" | "AI_ASSISTED";
  templateType: QuestionImportTemplateType;
  summary: QuestionImportSchemaSummary;
}

interface ColumnStats {
  index: number;
  sampleValues: string[];
  nonEmptyCount: number;
  longTextCount: number;
  questionTypeCount: number;
  answerLetterCount: number;
  answerNumericCount: number;
  judgeAnswerCount: number;
  lawSourceCount: number;
}

const headerAliasMap = {
  questionType: [
    "题型",
    "题型分类",
    "试题类型",
    "question_type",
    "questiontype",
  ],
  stem: ["题干", "题目", "试题", "题目内容", "stem", "question"],
  option: [
    "选项",
    "备选答案",
    "备选项",
    "option",
    "choice",
    "答案选项",
  ],
  answer: ["标准答案", "正确答案", "答案", "answer", "correct_answer"],
  analysis: ["答案解析", "解析", "analysis", "explanation"],
  lawSource: [
    "答案来源",
    "法条来源",
    "法律依据",
    "依据",
    "来源",
    "law_source",
  ],
  ignored: ["适用资格类别", "资格类别", "适用类别", "类别"],
} as const;

const questionTypeTokens = new Set([
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
]);

const judgeAnswerTokens = new Set([
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
]);

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[()（）]/g, "")
    .replace(/[:：]/g, "")
    .replace(/[\s_-]+/g, "");
}

function getCellValue(row: ImportSchemaSheetRow, columnIndex: number | null) {
  if (columnIndex === null || columnIndex < 0) {
    return "";
  }

  return String(row.values[columnIndex] ?? "").trim();
}

function isAnswerLetterValue(value: string) {
  return /^[A-F](?:[\s,，、/]+[A-F])*$/i.test(value.trim());
}

function isAnswerNumericValue(value: string) {
  return /^\d(?:[\s,，、/]+\d)*$/.test(value.trim());
}

function isJudgeAnswerValue(value: string) {
  return judgeAnswerTokens.has(normalizeText(value));
}

function looksLikeQuestionTypeValue(value: string) {
  return questionTypeTokens.has(normalizeText(value));
}

function looksLikeQuestionDataRow(row: ImportSchemaSheetRow) {
  const cells = row.values.map((value) => value.trim()).filter(Boolean);
  if (cells.length < 4) {
    return false;
  }

  const hasQuestionType = cells.slice(0, 3).some(looksLikeQuestionTypeValue);
  const hasLongText = cells.some((value) => value.length >= 8);
  const hasAnswer = cells.some(
    (value) =>
      isAnswerLetterValue(value) ||
      isAnswerNumericValue(value) ||
      isJudgeAnswerValue(value),
  );

  return hasQuestionType && hasLongText && hasAnswer;
}

function detectHeaderRowCount(rows: ImportSchemaSheetRow[]) {
  for (let index = 0; index < Math.min(rows.length, 4); index += 1) {
    if (looksLikeQuestionDataRow(rows[index])) {
      return index;
    }
  }

  return 1;
}

function buildHeaderTexts(rows: ImportSchemaSheetRow[], headerRowCount: number) {
  const headerRows = rows.slice(0, headerRowCount);
  const columnCount = headerRows.reduce(
    (maxValue, row) => Math.max(maxValue, row.values.length),
    0,
  );

  return Array.from({ length: columnCount }, (_, index) =>
    headerRows
      .map((row) => String(row.values[index] ?? "").trim())
      .filter(Boolean)
      .join(" | "),
  );
}

function buildColumnStats(rows: ImportSchemaSheetRow[], headerRowCount: number) {
  const dataRows = rows.slice(headerRowCount);
  const columnCount = rows.reduce(
    (maxValue, row) => Math.max(maxValue, row.values.length),
    0,
  );

  return Array.from({ length: columnCount }, (_, index) => {
    const sampleValues = dataRows
      .map((row) => getCellValue(row, index))
      .filter(Boolean)
      .slice(0, 8);
    const nonEmptyValues = dataRows
      .map((row) => getCellValue(row, index))
      .filter(Boolean);

    return {
      index,
      sampleValues,
      nonEmptyCount: nonEmptyValues.length,
      longTextCount: nonEmptyValues.filter((value) => value.length >= 12).length,
      questionTypeCount: nonEmptyValues.filter(looksLikeQuestionTypeValue).length,
      answerLetterCount: nonEmptyValues.filter(isAnswerLetterValue).length,
      answerNumericCount: nonEmptyValues.filter(isAnswerNumericValue).length,
      judgeAnswerCount: nonEmptyValues.filter(isJudgeAnswerValue).length,
      lawSourceCount: nonEmptyValues.filter(looksLikeLawSource).length,
    } satisfies ColumnStats;
  });
}

function findColumnByHeaderAliases(
  headerTexts: string[],
  aliases: readonly string[],
  excludedColumns: number[] = [],
) {
  const excluded = new Set(excludedColumns);
  const index = headerTexts.findIndex((text, currentIndex) => {
    if (excluded.has(currentIndex)) {
      return false;
    }

    const normalizedText = normalizeText(text);
    return aliases.some((alias) => normalizedText.includes(normalizeText(alias)));
  });

  return index >= 0 ? index : null;
}

function pickBestStatColumn(
  stats: ColumnStats[],
  excludedColumns: number[],
  scoreColumn: (column: ColumnStats) => number,
) {
  const excluded = new Set(excludedColumns);
  const scoredColumns = stats
    .filter((column) => !excluded.has(column.index))
    .map((column) => ({
      column,
      score: scoreColumn(column),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.column.nonEmptyCount !== left.column.nonEmptyCount) {
        return right.column.nonEmptyCount - left.column.nonEmptyCount;
      }

      return left.column.index - right.column.index;
    });

  return scoredColumns[0]?.column.index ?? null;
}

function inferQuestionTypeColumnByStats(
  stats: ColumnStats[],
  ignoredColumns: number[],
) {
  return pickBestStatColumn(stats, ignoredColumns, (column) => {
    if (column.nonEmptyCount === 0 || column.questionTypeCount === 0) {
      return 0;
    }

    const ratio = column.questionTypeCount / column.nonEmptyCount;
    if (ratio < 0.4) {
      return 0;
    }

    return column.questionTypeCount * 10 - column.longTextCount;
  });
}

function inferStemColumnByStats(
  stats: ColumnStats[],
  excludedColumns: number[],
) {
  return pickBestStatColumn(stats, excludedColumns, (column) => {
    if (column.nonEmptyCount === 0 || column.longTextCount === 0) {
      return 0;
    }

    const longTextRatio = column.longTextCount / column.nonEmptyCount;
    if (longTextRatio < 0.45) {
      return 0;
    }

    const answerSignals =
      column.answerLetterCount +
      column.answerNumericCount +
      column.judgeAnswerCount +
      column.questionTypeCount +
      column.lawSourceCount;

    return column.longTextCount * 10 - answerSignals * 2;
  });
}

function inferAnswerColumnByStats(
  stats: ColumnStats[],
  excludedColumns: number[],
) {
  return pickBestStatColumn(stats, excludedColumns, (column) => {
    if (column.nonEmptyCount === 0) {
      return 0;
    }

    const answerSignals =
      column.answerLetterCount +
      column.answerNumericCount +
      column.judgeAnswerCount;
    if (answerSignals === 0) {
      return 0;
    }

    const signalRatio = answerSignals / column.nonEmptyCount;
    if (signalRatio < 0.45) {
      return 0;
    }

    if (column.longTextCount > Math.ceil(column.nonEmptyCount * 0.2)) {
      return 0;
    }

    return answerSignals * 10 - column.lawSourceCount * 2;
  });
}

function inferLawSourceColumnByStats(
  stats: ColumnStats[],
  excludedColumns: number[],
) {
  return pickBestStatColumn(stats, excludedColumns, (column) => {
    if (column.nonEmptyCount === 0 || column.lawSourceCount === 0) {
      return 0;
    }

    const ratio = column.lawSourceCount / column.nonEmptyCount;
    if (ratio < 0.35) {
      return 0;
    }

    return column.lawSourceCount * 10 + column.longTextCount;
  });
}

function inferAnalysisColumnByStats(
  stats: ColumnStats[],
  excludedColumns: number[],
) {
  return pickBestStatColumn(stats, excludedColumns, (column) => {
    if (column.nonEmptyCount === 0 || column.longTextCount === 0) {
      return 0;
    }

    const longTextRatio = column.longTextCount / column.nonEmptyCount;
    if (longTextRatio < 0.35) {
      return 0;
    }

    const structuredSignals =
      column.answerLetterCount +
      column.answerNumericCount +
      column.judgeAnswerCount +
      column.questionTypeCount +
      column.lawSourceCount;

    if (column.lawSourceCount > Math.ceil(column.nonEmptyCount * 0.2)) {
      return 0;
    }

    return column.longTextCount * 10 - structuredSignals * 3;
  });
}

function findOptionColumnsByHeader(
  headerTexts: string[],
  excludedColumns: number[],
) {
  const excluded = new Set(excludedColumns);

  return headerTexts
    .map((text, index) => ({
      index,
      text,
    }))
    .filter(({ text, index }) => {
      if (excluded.has(index)) {
        return false;
      }

      const normalizedText = normalizeText(text);
      if (
        headerAliasMap.option.some((alias) =>
          normalizedText.includes(normalizeText(alias)),
        )
      ) {
        return true;
      }

      return /(?:^|\|)(?:[1-6]|[a-f])$/i.test(normalizedText);
    })
    .map((item) => item.index);
}

function detectOptionColumns(
  headerTexts: string[],
  headerRowCount: number,
  rows: ImportSchemaSheetRow[],
  stemColumn: number | null,
  answerColumn: number | null,
) {
  const directMatches = findOptionColumnsByHeader(
    headerTexts,
    [stemColumn, answerColumn].filter((item): item is number => item !== null),
  );

  if (directMatches.length >= 2) {
    return directMatches.slice(0, 6);
  }

  const stats = buildColumnStats(rows, headerRowCount);
  return stats
    .filter((item) => item.index !== stemColumn && item.index !== answerColumn)
    .filter((item) => item.nonEmptyCount > 0)
    .filter((item) => item.longTextCount < item.nonEmptyCount)
    .filter((item) => item.questionTypeCount === 0)
    .filter(
      (item) =>
        item.answerLetterCount +
          item.answerNumericCount +
          item.judgeAnswerCount <
        Math.ceil(item.nonEmptyCount * 0.5),
    )
    .filter((item) => item.lawSourceCount < Math.ceil(item.nonEmptyCount * 0.4))
    .filter((item) => item.index > (stemColumn ?? -1))
    .slice(0, 6)
    .map((item) => item.index);
}

function inferAnswerEncoding(
  rows: ImportSchemaSheetRow[],
  headerRowCount: number,
  answerColumn: number | null,
) {
  if (answerColumn === null) {
    return null;
  }

  const samples = rows
    .slice(headerRowCount)
    .map((row) => getCellValue(row, answerColumn))
    .filter(Boolean)
    .slice(0, 20);

  const numericCount = samples.filter(isAnswerNumericValue).length;
  const letterCount = samples.filter(isAnswerLetterValue).length;
  const judgeCount = samples.filter(isJudgeAnswerValue).length;

  if (numericCount >= Math.max(letterCount, judgeCount) && numericCount > 0) {
    return "NUMERIC_INDEX";
  }

  if (letterCount >= Math.max(numericCount, judgeCount) && letterCount > 0) {
    return "LETTER";
  }

  if (judgeCount > 0) {
    return "JUDGE_TEXT";
  }

  return null;
}

function isSchemaColumnConflict(schema: QuestionImportSchemaSummary) {
  const requiredColumns = [
    schema.questionTypeColumn,
    schema.stemColumn,
    schema.answerColumn,
    schema.analysisColumn,
    schema.lawSourceColumn,
  ].filter((value): value is number => value !== null);
  const columnSet = new Set<number>();

  for (const column of [...requiredColumns, ...schema.optionColumns]) {
    if (columnSet.has(column)) {
      return true;
    }

    columnSet.add(column);
  }

  return schema.ignoredColumns.some((column) => columnSet.has(column));
}

function buildDraftFromStructuredSchemaRow(
  row: ImportSchemaSheetRow,
  schema: QuestionImportSchemaSummary,
  sortOrder: number,
) {
  if (schema.questionTypeColumn === null) {
    throw new Error("未识别到题型列");
  }

  if (schema.stemColumn === null) {
    throw new Error("未识别到题干列");
  }

  if (schema.answerColumn === null) {
    throw new Error("未识别到答案列");
  }

  const questionType = normalizeImportQuestionTypeValue(
    getCellValue(row, schema.questionTypeColumn),
  );
  const stem = getCellValue(row, schema.stemColumn);
  const answer = getCellValue(row, schema.answerColumn);
  const rawAnalysis = getCellValue(row, schema.analysisColumn);
  const rawLawSource = getCellValue(row, schema.lawSourceColumn);
  const lawSource =
    rawLawSource || (!rawLawSource && looksLikeLawSource(rawAnalysis) ? rawAnalysis : "");
  const analysis = lawSource ? undefined : rawAnalysis || undefined;
  const optionValues = schema.optionColumns
    .slice(0, 6)
    .map((columnIndex) => getCellValue(row, columnIndex))
    .filter(Boolean);

  const record = questionImportRowSchema.parse({
    question_type: questionType,
    stem,
    option_a: optionValues[0] || undefined,
    option_b: optionValues[1] || undefined,
    option_c: optionValues[2] || undefined,
    option_d: optionValues[3] || undefined,
    option_e: optionValues[4] || undefined,
    option_f: optionValues[5] || undefined,
    correct_answer: answer,
    analysis,
    law_source: lawSource || undefined,
    sort_order: sortOrder,
  });

  const questionInput = normalizeQuestionInput(mapImportRowToQuestionInput(record));

  return questionImportDraftSchema.parse({
    ...questionInput,
    sortOrder,
    sourceLabel: `第 ${row.rowNumber} 行`,
    sourceContent: row.content,
    sourceRowNumbers: [row.rowNumber],
  }) satisfies QuestionImportDraftInput;
}

function validateStructuredSchema(
  rows: ImportSchemaSheetRow[],
  schema: QuestionImportSchemaSummary,
) {
  if (schema.headerRowCount < 1) {
    throw new Error("未识别到有效表头行数");
  }

  if (schema.stemColumn === null || schema.answerColumn === null) {
    throw new Error("题干列或答案列缺失");
  }

  if (schema.optionColumns.length < 2) {
    throw new Error("选项列数量不足");
  }

  if (isSchemaColumnConflict(schema)) {
    throw new Error("导题列语义冲突，无法安全解析");
  }

  const sampleRows = rows.slice(schema.headerRowCount, schema.headerRowCount + 12);
  const validCount = sampleRows.reduce((count, row, index) => {
    try {
      buildDraftFromStructuredSchemaRow(row, schema, index + 1);
      return count + 1;
    } catch {
      return count;
    }
  }, 0);

  const minValidCount = Math.min(3, sampleRows.length);
  const validRatio = sampleRows.length === 0 ? 0 : validCount / sampleRows.length;

  if (validCount < minValidCount || validRatio < 0.6) {
    throw new Error("列语义识别结果不稳定，已阻止整批导入");
  }
}

function buildHeuristicSchema(
  rows: ImportSchemaSheetRow[],
): DetectedQuestionImportSchema | null {
  const headerRowCount = detectHeaderRowCount(rows);
  const headerTexts = buildHeaderTexts(rows, headerRowCount);
  const stats = buildColumnStats(rows, headerRowCount);
  const ignoredColumns = headerTexts
    .map((text, index) => ({
      index,
      matched: headerAliasMap.ignored.some((alias) =>
        normalizeText(text).includes(normalizeText(alias)),
      ),
    }))
    .filter((item) => item.matched)
    .map((item) => item.index);

  const questionTypeColumn =
    findColumnByHeaderAliases(headerTexts, headerAliasMap.questionType) ??
    inferQuestionTypeColumnByStats(stats, ignoredColumns) ??
    null;
  const stemColumn =
    findColumnByHeaderAliases(headerTexts, headerAliasMap.stem, ignoredColumns) ??
    inferStemColumnByStats(
      stats,
      [...ignoredColumns, questionTypeColumn].filter(
        (item): item is number => item !== null,
      ),
    ) ??
    null;
  const answerColumn =
    findColumnByHeaderAliases(headerTexts, headerAliasMap.answer, ignoredColumns) ??
    inferAnswerColumnByStats(
      stats,
      [...ignoredColumns, questionTypeColumn, stemColumn].filter(
        (item): item is number => item !== null,
      ),
    ) ??
    null;
  const lawSourceColumnRaw = findColumnByHeaderAliases(
    headerTexts,
    headerAliasMap.lawSource,
    ignoredColumns,
  ) ??
    inferLawSourceColumnByStats(
      stats,
      [...ignoredColumns, questionTypeColumn, stemColumn, answerColumn].filter(
        (item): item is number => item !== null,
      ),
    );
  const analysisColumnRaw = findColumnByHeaderAliases(
    headerTexts,
    headerAliasMap.analysis,
    ignoredColumns,
  ) ??
    inferAnalysisColumnByStats(
      stats,
      [
        ...ignoredColumns,
        questionTypeColumn,
        stemColumn,
        answerColumn,
        lawSourceColumnRaw,
      ].filter((item): item is number => item !== null),
    );
  const optionColumns = detectOptionColumns(
    headerTexts,
    headerRowCount,
    rows,
    stemColumn,
    answerColumn,
  ).filter((column) => !ignoredColumns.includes(column));

  const summary: QuestionImportSchemaSummary = {
    headerRowCount,
    questionTypeColumn,
    stemColumn,
    optionColumns,
    answerColumn,
    analysisColumn: analysisColumnRaw ?? null,
    lawSourceColumn: lawSourceColumnRaw ?? null,
    ignoredColumns,
    answerEncoding: inferAnswerEncoding(rows, headerRowCount, answerColumn),
  };

  try {
    validateStructuredSchema(rows, summary);
    return {
      mode: "HEURISTIC",
      templateType: QuestionImportTemplateType.AI,
      summary,
    };
  } catch {
    return null;
  }
}

/**
 * 功能说明：
 * 为非标准 Excel 识别整批统一的列语义，避免不同分块对同一列做出不一致解释。
 *
 * 业务背景：
 * 题库 Excel 来源复杂，但大多数仍然是多列结构化表格。先锁定整批 schema，再按固定规则解析，
 * 比逐块让模型直接猜题目更稳定，也更容易审计和回滚。
 *
 * 核心逻辑：
 * 优先使用本地表头规则和列值特征识别 schema；本地规则不足时，再让 AI 对整批样本做一次辅助判断，
 * 最后由本地校验器确认 schema 是否足够稳定。
 *
 * 关键约束：
 * 同一批次只能使用一套 schema；schema 不稳定时整批失败，不允许继续生成可能污染题库的草稿。
 */
export async function detectStructuredQuestionImportSchema(
  rows: ImportSchemaSheetRow[],
): Promise<DetectedQuestionImportSchema> {
  const heuristic = buildHeuristicSchema(rows);
  if (heuristic) {
    return heuristic;
  }

  const aiSummary = await detectQuestionImportSchemaWithAi(rows);
  validateStructuredSchema(rows, aiSummary);

  return {
    mode: "AI_ASSISTED",
    templateType: QuestionImportTemplateType.AI,
    summary: aiSummary,
  };
}

/**
 * 功能说明：
 * 按批次级 schema 逐行生成可确认入库的题目草稿，并返回失败行用于界面审计。
 *
 * 业务背景：
 * Excel 一旦锁定整批列语义，后续题型、选项、答案归一化都应由后端固定规则执行，避免模型再次介入。
 *
 * 核心逻辑：
 * 从 schema 指定的列读取题型、题干、选项、答案、解析和来源，并复用现有题目归一化校验逻辑逐行解析。
 *
 * 关键约束：
 * 只有通过行级校验的记录才会进入草稿；失败行必须保留原始来源行号和失败原因，便于人工回看。
 */
export function parseRowsWithStructuredSchema(
  rows: ImportSchemaSheetRow[],
  schema: QuestionImportSchemaSummary,
  startingSortOrder: number,
) {
  const drafts: QuestionImportDraftInput[] = [];
  const failedRows: StructuredSchemaFailedRow[] = [];
  let nextSortOrder = startingSortOrder;

  for (const row of rows.slice(schema.headerRowCount)) {
    try {
      const draft = buildDraftFromStructuredSchemaRow(
        row,
        schema,
        nextSortOrder,
      );
      drafts.push(draft);
      nextSortOrder += 1;
    } catch (error) {
      failedRows.push({
        rowNumber: row.rowNumber,
        content: row.content,
        reason: error instanceof Error ? error.message : "该行无法转换为题目",
      });
    }
  }

  return {
    drafts,
    failedRows,
    headerRowNumbers: rows.slice(0, schema.headerRowCount).map((row) => row.rowNumber),
  };
}

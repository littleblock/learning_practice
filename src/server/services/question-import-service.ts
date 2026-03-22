import {
  JobType,
  Prisma,
  QuestionImportBatchStatus,
  QuestionImportSourceStatus,
  QuestionImportTemplateType,
} from "@prisma/client";
import * as XLSX from "xlsx";

import {
  questionImportDraftSchema,
  questionImportRowSchema,
  questionOptionSchema,
  type DeleteImportDraftsInput,
  type QuestionImportDraftInput,
} from "@/shared/schemas/question";
import type {
  QuestionImportBatchDetail,
  QuestionImportSourceRowItem,
  QuestionImportDraftItem,
  QuestionImportBatchSummary,
} from "@/shared/types/domain";
import { EXCEL_MAX_SIZE_BYTES } from "@/shared/constants/app";
import {
  isAllowedExcelFile,
  isAllowedExcelMimeType,
} from "@/shared/utils/file";
import { resolvePagination } from "@/shared/utils/pagination";
import { prisma } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { enqueueJob } from "@/server/repositories/job-repository";
import {
  AiSplitConcurrencyController,
  mapWithAdaptiveConcurrency,
} from "@/server/services/ai-split-concurrency";
import { assertBankExists } from "@/server/services/bank-service";
import {
  isAiRateLimitError,
  splitQuestionsWithAi,
  type AiSourceRowInput,
} from "@/server/services/question-import-ai-service";
import { refreshQuestionEmbeddings } from "@/server/services/matching-service";
import {
  looksLikeLawSource,
  mapImportRowToQuestionInput,
  normalizeImportQuestionTypeValue,
  normalizeQuestionInput,
} from "@/server/services/question-payload";
import {
  readStoredFile,
  saveUploadedFile,
} from "@/server/storage/file-storage";

export interface SheetRow {
  rowNumber: number;
  values: string[];
  content: string;
}

interface FailedSourceRow {
  rowNumber: number;
  content: string;
  reason: string;
}

interface ParsedWorkbookResult {
  sourceSheetName: string;
  templateType: QuestionImportTemplateType;
  drafts: QuestionImportDraftInput[];
  sourceRows: QuestionImportSourceRowItem[];
  persistedDuringParsing?: boolean;
}

const questionCreateChunkSize = 200;
const standardTemplateChunkCount = 1;

interface ParsedAiChunkResult {
  drafts: QuestionImportDraftInput[];
  failedRows: FailedSourceRow[];
}

interface PersistableAiChunkResult extends ParsedAiChunkResult {
  rows: SheetRow[];
}

async function initializeBatchProgress(
  batchId: string,
  input: {
    totalSourceRows: number;
    processedSourceRows: number;
    totalChunks: number;
    processedChunks: number;
    currentConcurrency: number;
  },
) {
  await prisma.questionImportBatch.update({
    where: { id: batchId },
    data: input,
  });
}

async function syncBatchProcessingProgress(
  batchId: string,
  input: {
    processedSourceRowsIncrement?: number;
    processedChunksIncrement?: number;
    currentConcurrency: number;
  },
) {
  await prisma.questionImportBatch.update({
    where: { id: batchId },
    data: {
      ...(input.processedSourceRowsIncrement
        ? {
            processedSourceRows: {
              increment: input.processedSourceRowsIncrement,
            },
          }
        : {}),
      ...(input.processedChunksIncrement
        ? {
            processedChunks: {
              increment: input.processedChunksIncrement,
            },
          }
        : {}),
      currentConcurrency: input.currentConcurrency,
    },
  });
}

const standardTemplateColumns = [
  { key: "question_type", label: "题型" },
  { key: "stem", label: "题干" },
  { key: "option_a", label: "选项A" },
  { key: "option_b", label: "选项B" },
  { key: "option_c", label: "选项C" },
  { key: "option_d", label: "选项D" },
  { key: "option_e", label: "选项E" },
  { key: "option_f", label: "选项F" },
  { key: "correct_answer", label: "正确答案" },
  { key: "analysis", label: "解析" },
  { key: "law_source", label: "答案来源" },
  { key: "sort_order", label: "序号" },
] as const;

const standardTemplateHeaderKeys = standardTemplateColumns.map((column) =>
  normalizeHeaderKey(column.label),
);

function isRowEmpty(values: string[]) {
  return values.every((value) => value.trim().length === 0);
}

function normalizeHeaderKey(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[()（）]/g, "")
    .replace(/[:：]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function buildRowContent(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
}

function buildSourceRowLabel(sourceRowNumbers: number[]) {
  const numbers = Array.from(new Set(sourceRowNumbers)).sort(
    (left, right) => left - right,
  );
  if (numbers.length === 1) {
    return `第 ${numbers[0]} 行`;
  }

  return `第 ${numbers[0]}-${numbers[numbers.length - 1]} 行`;
}

function parseStringArray(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.map((item) => String(item));
}

function parseNumberArray(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function mapDraftRecord(item: {
  id: string;
  type: QuestionImportDraftItem["type"];
  stem: string;
  options: Prisma.JsonValue;
  correctAnswers: Prisma.JsonValue;
  analysis: string | null;
  lawSource: string | null;
  sortOrder: number;
  sourceLabel: string | null;
  sourceContent: string | null;
  sourceRowNumbers: Prisma.JsonValue | null;
  isDeleted: boolean;
}): QuestionImportDraftItem {
  return {
    id: item.id,
    type: item.type,
    stem: item.stem,
    options: questionOptionSchema.array().parse(item.options),
    correctAnswers: parseStringArray(item.correctAnswers),
    analysis: item.analysis,
    lawSource: item.lawSource,
    sortOrder: item.sortOrder,
    sourceLabel: item.sourceLabel,
    sourceContent: item.sourceContent,
    sourceRowNumbers: parseNumberArray(item.sourceRowNumbers),
    isDeleted: item.isDeleted,
  };
}

function mapSourceRowRecord(item: {
  id: string;
  rowNumber: number;
  status: QuestionImportSourceStatus;
  content: string;
  reason: string | null;
  matchedSortOrders: Prisma.JsonValue | null;
}): QuestionImportSourceRowItem {
  return {
    id: item.id,
    rowNumber: item.rowNumber,
    status: item.status,
    content: item.content,
    reason: item.reason,
    matchedSortOrders: parseNumberArray(item.matchedSortOrders),
  };
}

function mapBatchSummary(item: {
  id: string;
  fileName: string;
  sourceSheetName: string | null;
  templateType: QuestionImportTemplateType | null;
  status: QuestionImportBatchStatus;
  draftCount: number;
  totalSourceRows: number;
  processedSourceRows: number;
  totalChunks: number;
  processedChunks: number;
  currentConcurrency: number;
  lastError: string | null;
  createdAt: Date;
  parsedAt: Date | null;
  confirmedAt: Date | null;
}): QuestionImportBatchSummary {
  return {
    id: item.id,
    fileName: item.fileName,
    sourceSheetName: item.sourceSheetName,
    templateType: item.templateType,
    status: item.status,
    draftCount: item.draftCount,
    totalSourceRows: item.totalSourceRows,
    processedSourceRows: item.processedSourceRows,
    totalChunks: item.totalChunks,
    processedChunks: item.processedChunks,
    currentConcurrency: item.currentConcurrency,
    lastError: item.lastError,
    createdAt: item.createdAt.toISOString(),
    parsedAt: item.parsedAt?.toISOString() ?? null,
    confirmedAt: item.confirmedAt?.toISOString() ?? null,
  };
}

async function buildQuestionImportBatchDetail(
  batchId: string,
): Promise<QuestionImportBatchDetail> {
  const batch = await prisma.questionImportBatch.findUnique({
    where: { id: batchId },
    include: {
      drafts: {
        where: {
          isDeleted: false,
        },
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          type: true,
          stem: true,
          options: true,
          correctAnswers: true,
          analysis: true,
          lawSource: true,
          sortOrder: true,
          sourceLabel: true,
          sourceContent: true,
          sourceRowNumbers: true,
          isDeleted: true,
        },
      },
      sourceRows: {
        orderBy: {
          rowNumber: "asc",
        },
        select: {
          id: true,
          rowNumber: true,
          status: true,
          content: true,
          reason: true,
          matchedSortOrders: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("导题批次不存在");
  }

  return {
    id: batch.id,
    bankId: batch.bankId,
    fileName: batch.fileName,
    sourceSheetName: batch.sourceSheetName,
    templateType: batch.templateType,
    status: batch.status,
    draftCount: batch.draftCount,
    totalSourceRows: batch.totalSourceRows,
    processedSourceRows: batch.processedSourceRows,
    totalChunks: batch.totalChunks,
    processedChunks: batch.processedChunks,
    currentConcurrency: batch.currentConcurrency,
    lastError: batch.lastError,
    createdAt: batch.createdAt.toISOString(),
    parsedAt: batch.parsedAt?.toISOString() ?? null,
    confirmedAt: batch.confirmedAt?.toISOString() ?? null,
    drafts: batch.drafts.map(mapDraftRecord),
    sourceRows: batch.sourceRows.map(mapSourceRowRecord),
  };
}

async function syncBatchDraftCount(
  tx: Prisma.TransactionClient,
  batchId: string,
) {
  const draftCount = await tx.questionImportDraft.count({
    where: {
      batchId,
      isDeleted: false,
    },
  });

  await tx.questionImportBatch.update({
    where: { id: batchId },
    data: {
      draftCount,
    },
  });
}

function assignSequentialSortOrders(
  drafts: QuestionImportDraftInput[],
  startingSortOrder: number,
) {
  return drafts.map((draft, index) => ({
    ...draft,
    sortOrder: startingSortOrder + index,
  }));
}

async function appendBatchChunkParseResult(
  batchId: string,
  input: {
    drafts: QuestionImportDraftInput[];
    sourceRows: QuestionImportSourceRowItem[];
  },
) {
  await prisma.$transaction(async (tx) => {
    if (input.drafts.length > 0) {
      await tx.questionImportDraft.createMany({
        data: input.drafts.map((draft) => ({
          batchId,
          type: draft.type,
          stem: draft.stem,
          options: draft.options,
          correctAnswers: draft.correctAnswers,
          analysis: draft.analysis || null,
          lawSource: draft.lawSource || null,
          sortOrder: draft.sortOrder,
          sourceLabel:
            draft.sourceLabel || buildSourceRowLabel(draft.sourceRowNumbers),
          sourceContent: draft.sourceContent || null,
          sourceRowNumbers: draft.sourceRowNumbers,
        })),
      });

      await tx.questionImportBatch.update({
        where: { id: batchId },
        data: {
          draftCount: {
            increment: input.drafts.length,
          },
        },
      });
    }

    if (input.sourceRows.length > 0) {
      await tx.questionImportSourceRow.createMany({
        data: input.sourceRows.map((row) => ({
          batchId,
          rowNumber: row.rowNumber,
          status: row.status,
          content: row.content,
          reason: row.reason,
          matchedSortOrders: row.matchedSortOrders,
        })),
      });
    }
  });
}

function extractSheetRows(sheet: XLSX.WorkSheet) {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  return rawRows
    .map((row, index) => {
      const values = row.map((value) => String(value ?? ""));
      return {
        rowNumber: index + 1,
        values,
        content: buildRowContent(values),
      } satisfies SheetRow;
    })
    .filter((row) => !isRowEmpty(row.values));
}

export function isStandardTemplate(rows: SheetRow[]) {
  const headerRow = rows[0];
  if (!headerRow) {
    return false;
  }

  if (headerRow.values.length < standardTemplateHeaderKeys.length) {
    return false;
  }

  const headerKeys = headerRow.values
    .slice(0, standardTemplateHeaderKeys.length)
    .map(normalizeHeaderKey);
  const hasExtraContent = headerRow.values
    .slice(standardTemplateHeaderKeys.length)
    .some((value) => value.trim().length > 0);

  return (
    !hasExtraContent &&
    headerKeys.every((key, index) => key === standardTemplateHeaderKeys[index])
  );
}

function normalizeSortOrderValue(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeStructuredRowRecord(
  record: Record<string, string>,
  fallbackSortOrder: number,
) {
  const analysisValue = (record.analysis ?? "").trim();
  const lawSourceValue = (record.law_source ?? "").trim();
  const inferredLawSource =
    !lawSourceValue && looksLikeLawSource(analysisValue) ? analysisValue : "";

  return questionImportRowSchema.parse({
    question_type: normalizeImportQuestionTypeValue(
      String(record.question_type ?? ""),
    ),
    stem: String(record.stem ?? ""),
    option_a: (record.option_a ?? "").trim() || undefined,
    option_b: (record.option_b ?? "").trim() || undefined,
    option_c: (record.option_c ?? "").trim() || undefined,
    option_d: (record.option_d ?? "").trim() || undefined,
    option_e: (record.option_e ?? "").trim() || undefined,
    option_f: (record.option_f ?? "").trim() || undefined,
    correct_answer: String(record.correct_answer ?? ""),
    analysis:
      lawSourceValue || inferredLawSource
        ? undefined
        : analysisValue || undefined,
    law_source: lawSourceValue || inferredLawSource || undefined,
    sort_order:
      normalizeSortOrderValue(record.sort_order ?? "") ?? fallbackSortOrder,
  });
}

function normalizeDraftSortOrders(
  drafts: QuestionImportDraftInput[],
  startingSortOrder: number,
) {
  const usedSortOrders = new Set<number>();
  let nextSortOrder = Math.max(
    startingSortOrder,
    ...drafts.map((draft) =>
      draft.sortOrder > 0 ? draft.sortOrder + 1 : startingSortOrder,
    ),
  );

  return drafts.map((draft) => {
    const desiredSortOrder = draft.sortOrder;

    if (desiredSortOrder > 0 && !usedSortOrders.has(desiredSortOrder)) {
      usedSortOrders.add(desiredSortOrder);
      nextSortOrder = Math.max(nextSortOrder, desiredSortOrder + 1);
      return draft;
    }

    while (usedSortOrders.has(nextSortOrder)) {
      nextSortOrder += 1;
    }

    const normalized = {
      ...draft,
      sortOrder: nextSortOrder,
    };
    usedSortOrders.add(nextSortOrder);
    nextSortOrder += 1;

    return normalized;
  });
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function tryParseSingleRowFallback(
  row: SheetRow,
  sortOrder: number,
): QuestionImportDraftInput | null {
  const cells = row.values.map((value) => value.trim()).filter(Boolean);
  if (cells.length < 5) {
    return null;
  }

  let questionType: ReturnType<typeof normalizeImportQuestionTypeValue>;
  try {
    questionType = normalizeImportQuestionTypeValue(cells[0]);
  } catch {
    return null;
  }

  let stemIndex = 1;
  while (stemIndex < cells.length && cells[stemIndex].length < 5) {
    stemIndex += 1;
  }

  if (stemIndex >= cells.length - 3) {
    return null;
  }

  const stem = cells[stemIndex];
  const tailCells = cells.slice(stemIndex + 1);
  let lawSource: string | undefined;
  let candidateCells = tailCells;

  const lastCell = candidateCells.at(-1);
  if (lastCell && looksLikeLawSource(lastCell)) {
    lawSource = lastCell;
    candidateCells = candidateCells.slice(0, -1);
  }

  if (candidateCells.length < 3 || candidateCells.length > 7) {
    return null;
  }

  const correctAnswer = candidateCells.at(-1);
  if (!correctAnswer) {
    return null;
  }

  const optionValues = candidateCells.slice(0, -1);
  if (optionValues.length < 2 || optionValues.length > 6) {
    return null;
  }

  const record = questionImportRowSchema.parse({
    question_type: questionType,
    stem,
    option_a: optionValues[0],
    option_b: optionValues[1],
    option_c: optionValues[2],
    option_d: optionValues[3],
    option_e: optionValues[4],
    option_f: optionValues[5],
    correct_answer: correctAnswer,
    law_source: lawSource,
    sort_order: sortOrder,
  });

  const normalized = normalizeQuestionInput({
    ...mapImportRowToQuestionInput(record),
    sortOrder,
  });

  return questionImportDraftSchema.parse({
    ...normalized,
    sortOrder,
    sourceLabel: buildSourceRowLabel([row.rowNumber]),
    sourceContent: row.content,
    sourceRowNumbers: [row.rowNumber],
  });
}

function buildSourceRowStatuses(
  rows: SheetRow[],
  drafts: QuestionImportDraftInput[],
  failedRows: FailedSourceRow[],
  headerRowNumbers: number[] = [],
) {
  const matchedMap = new Map<number, number[]>();
  const failedMap = new Map(
    failedRows.map((row) => [row.rowNumber, row] as const),
  );
  const headerSet = new Set(headerRowNumbers);

  for (const draft of drafts) {
    for (const rowNumber of draft.sourceRowNumbers) {
      const matchedSortOrders = matchedMap.get(rowNumber) ?? [];
      matchedSortOrders.push(draft.sortOrder);
      matchedMap.set(rowNumber, matchedSortOrders);
    }
  }

  return rows.map((row) => {
    if (headerSet.has(row.rowNumber)) {
      return {
        id: `row-${row.rowNumber}`,
        rowNumber: row.rowNumber,
        status: QuestionImportSourceStatus.HEADER,
        content: row.content,
        reason: "标准模板表头行",
        matchedSortOrders: [],
      } satisfies QuestionImportSourceRowItem;
    }

    const matchedSortOrders = matchedMap.get(row.rowNumber);
    if (matchedSortOrders && matchedSortOrders.length > 0) {
      return {
        id: `row-${row.rowNumber}`,
        rowNumber: row.rowNumber,
        status: QuestionImportSourceStatus.MATCHED,
        content: row.content,
        reason: null,
        matchedSortOrders: Array.from(new Set(matchedSortOrders)).sort(
          (left, right) => left - right,
        ),
      } satisfies QuestionImportSourceRowItem;
    }

    const failedRow = failedMap.get(row.rowNumber);
    return {
      id: `row-${row.rowNumber}`,
      rowNumber: row.rowNumber,
      status: QuestionImportSourceStatus.FAILED,
      content: row.content,
      reason: failedRow?.reason ?? "未识别为完整题目，请调整内容或改用标准模板",
      matchedSortOrders: [],
    } satisfies QuestionImportSourceRowItem;
  });
}

export function parseStandardTemplateDrafts(
  rows: SheetRow[],
  startingSortOrder: number,
) {
  const drafts: QuestionImportDraftInput[] = [];
  const failedRows: FailedSourceRow[] = [];
  let nextSortOrder = startingSortOrder;

  for (const row of rows.slice(1)) {
    try {
      const record = Object.fromEntries(
        standardTemplateColumns.map((column, index) => [
          column.key,
          String(row.values[index] ?? ""),
        ]),
      );
      const parsedRow = normalizeStructuredRowRecord(record, nextSortOrder);
      const questionInput = mapImportRowToQuestionInput(parsedRow);
      const sortOrder = questionInput.sortOrder ?? nextSortOrder;

      drafts.push(
        questionImportDraftSchema.parse({
          ...questionInput,
          sortOrder,
          sourceLabel: `第 ${row.rowNumber} 行`,
          sourceContent: row.content,
          sourceRowNumbers: [row.rowNumber],
        }),
      );
      nextSortOrder = Math.max(nextSortOrder, sortOrder + 1);
    } catch (error) {
      failedRows.push({
        rowNumber: row.rowNumber,
        content: row.content,
        reason: error instanceof Error ? error.message : "该行无法转换为题目",
      });
    }
  }

  const normalizedDrafts = normalizeDraftSortOrders(drafts, startingSortOrder);
  return {
    templateType: QuestionImportTemplateType.STANDARD,
    drafts: normalizedDrafts,
    sourceRows: buildSourceRowStatuses(rows, normalizedDrafts, failedRows, [
      rows[0].rowNumber,
    ]),
  } satisfies Omit<ParsedWorkbookResult, "sourceSheetName">;
}

function buildAiChunks(rows: SheetRow[]) {
  const env = getServerEnv();
  const chunks: SheetRow[][] = [];
  let currentChunk: SheetRow[] = [];
  let currentLength = 0;

  for (const row of rows) {
    const rowText = `第 ${row.rowNumber} 行 | ${row.content}`;
    const nextLength =
      currentLength + rowText.length + (currentChunk.length > 0 ? 1 : 0);

    if (
      currentChunk.length >= env.AI_SPLIT_CHUNK_ROW_LIMIT ||
      nextLength > env.AI_SPLIT_CHUNK_TEXT_LIMIT
    ) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      currentChunk = [row];
      currentLength = rowText.length;
      continue;
    }

    currentChunk.push(row);
    currentLength = nextLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function isFatalAiError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /AI_SPLIT_API_KEY|调用失败|未配置/.test(error.message);
}

async function parseAiChunkRows(
  rows: SheetRow[],
  startingSortOrder: number,
): Promise<{
  drafts: QuestionImportDraftInput[];
  failedRows: FailedSourceRow[];
}> {
  if (rows.length === 0) {
    return {
      drafts: [],
      failedRows: [],
    };
  }

  const aiRows: AiSourceRowInput[] = rows.map((row) => ({
    rowNumber: row.rowNumber,
    content: row.content,
  }));

  try {
    return {
      drafts: await splitQuestionsWithAi(aiRows, startingSortOrder),
      failedRows: [],
    };
  } catch (error) {
    if (isFatalAiError(error)) {
      throw error;
    }

    if (rows.length === 1) {
      const fallbackDraft = tryParseSingleRowFallback(
        rows[0],
        startingSortOrder,
      );
      if (fallbackDraft) {
        logger.warn(
          {
            rowNumber: rows[0].rowNumber,
            reason: error instanceof Error ? error.message : String(error),
          },
          "AI 单行拆题失败，已回退到本地兜底解析",
        );

        return {
          drafts: [fallbackDraft],
          failedRows: [],
        };
      }

      return {
        drafts: [],
        failedRows: [
          {
            rowNumber: rows[0].rowNumber,
            content: rows[0].content,
            reason:
              error instanceof Error ? error.message : "AI 未识别为完整题目",
          },
        ],
      };
    }

    logger.warn(
      {
        rowCount: rows.length,
        startingSortOrder,
      },
      "AI 分块解析失败，自动缩小分块重试",
    );

    const middleIndex = Math.ceil(rows.length / 2);
    const left = await parseAiChunkRows(
      rows.slice(0, middleIndex),
      startingSortOrder,
    );
    const nextSortOrder = Math.max(
      startingSortOrder,
      ...left.drafts.map((draft) => draft.sortOrder + 1),
    );
    const right = await parseAiChunkRows(
      rows.slice(middleIndex),
      nextSortOrder,
    );

    return {
      drafts: [...left.drafts, ...right.drafts],
      failedRows: [...left.failedRows, ...right.failedRows],
    };
  }
}

async function parseRowsWithAi(
  batchId: string,
  rows: SheetRow[],
  startingSortOrder: number,
) {
  const env = getServerEnv();
  const chunks = buildAiChunks(rows);
  const controller = new AiSplitConcurrencyController();
  const drafts: QuestionImportDraftInput[] = [];
  const sourceRows: QuestionImportSourceRowItem[] = [];
  const pendingChunks = new Map<number, PersistableAiChunkResult>();
  let nextChunkToPersist = 0;
  let nextSortOrder = startingSortOrder;
  let persistChain = Promise.resolve();

  await initializeBatchProgress(batchId, {
    totalSourceRows: rows.length,
    processedSourceRows: 0,
    totalChunks: chunks.length,
    processedChunks: 0,
    currentConcurrency: controller.getLimit(),
  });

  const flushReadyChunks = async () => {
    while (pendingChunks.has(nextChunkToPersist)) {
      const chunk = pendingChunks.get(nextChunkToPersist);
      if (!chunk) {
        break;
      }

      pendingChunks.delete(nextChunkToPersist);

      const normalizedChunkDrafts = assignSequentialSortOrders(
        chunk.drafts,
        nextSortOrder,
      );
      nextSortOrder += normalizedChunkDrafts.length;

      const chunkSourceRows = buildSourceRowStatuses(
        chunk.rows,
        normalizedChunkDrafts,
        chunk.failedRows,
      );

      await appendBatchChunkParseResult(batchId, {
        drafts: normalizedChunkDrafts,
        sourceRows: chunkSourceRows,
      });
      drafts.push(...normalizedChunkDrafts);
      sourceRows.push(...chunkSourceRows);

      await syncBatchProcessingProgress(batchId, {
        processedSourceRowsIncrement: chunk.rows.length,
        processedChunksIncrement: 1,
        currentConcurrency: controller.getLimit(),
      });

      nextChunkToPersist += 1;
    }
  };

  await mapWithAdaptiveConcurrency(
    chunks,
    controller,
    async (chunkRows, chunkIndex): Promise<void> => {
      let rateLimitRecoveries = 0;

      while (true) {
        try {
          const parsed = await parseAiChunkRows(chunkRows, startingSortOrder);
          const persistTask = persistChain.then(async () => {
            pendingChunks.set(chunkIndex, {
              rows: chunkRows,
              drafts: parsed.drafts,
              failedRows: parsed.failedRows,
            });
            await flushReadyChunks();
          });
          persistChain = persistTask.then(
            () => undefined,
            () => undefined,
          );
          await persistTask;

          await controller.recordSuccess({
            onStateChange: async (state) => {
              await syncBatchProcessingProgress(batchId, {
                currentConcurrency: state.currentConcurrency,
              });
            },
          });
          return;
        } catch (error) {
          if (!isAiRateLimitError(error)) {
            throw error;
          }

          rateLimitRecoveries += 1;
          await controller.recordRateLimit({
            onStateChange: async (state) => {
              await syncBatchProcessingProgress(batchId, {
                currentConcurrency: state.currentConcurrency,
              });
            },
          });

          if (rateLimitRecoveries > env.AI_SPLIT_MAX_RETRIES + 2) {
            throw error;
          }

          await controller.waitForCooldown();
        }
      }
    },
  );
  await persistChain;
  return {
    templateType: QuestionImportTemplateType.AI,
    drafts,
    sourceRows,
    persistedDuringParsing: true,
  } satisfies Omit<ParsedWorkbookResult, "sourceSheetName">;
}

async function parseWorkbookToDrafts(
  bankId: string,
  batchId: string,
  buffer: Buffer,
): Promise<ParsedWorkbookResult> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Excel 文件中不存在可用工作表");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = extractSheetRows(sheet);

  if (rows.length === 0) {
    throw new Error("Excel 文件中没有可导入内容");
  }

  const aggregate = await prisma.question.aggregate({
    where: { bankId },
    _max: {
      sortOrder: true,
    },
  });
  const startingSortOrder = (aggregate._max.sortOrder ?? 0) + 1;
  const templateType = isStandardTemplate(rows)
    ? QuestionImportTemplateType.STANDARD
    : QuestionImportTemplateType.AI;

  await prisma.questionImportBatch.update({
    where: { id: batchId },
    data: {
      sourceSheetName: firstSheetName,
      templateType,
    },
  });

  const parsed =
    templateType === QuestionImportTemplateType.STANDARD
      ? parseStandardTemplateDrafts(rows, startingSortOrder)
      : await parseRowsWithAi(batchId, rows, startingSortOrder);

  if (parsed.templateType === QuestionImportTemplateType.STANDARD) {
    await initializeBatchProgress(batchId, {
      totalSourceRows: rows.length,
      processedSourceRows: rows.length,
      totalChunks: standardTemplateChunkCount,
      processedChunks: standardTemplateChunkCount,
      currentConcurrency: 0,
    });
  }

  return {
    sourceSheetName: firstSheetName,
    ...parsed,
  } satisfies ParsedWorkbookResult;
}

/**
 * 功能说明：
 * 管理 Excel 导题批次、解析结果和确认入库流程。
 *
 * 业务背景：
 * 导题文件来源分散且模板不稳定，系统需要同时支持标准模板的规则解析，以及非标准文件的 AI 识别。
 *
 * 核心逻辑：
 * 标准模板仅走规则解析，其他文件全部走 AI 拆题，并为每一行原始内容生成可查看的匹配状态。
 *
 * 关键约束：
 * 批次只有在 READY 状态下才允许删除草稿或确认入库；内容无法成题时保留失败记录，不再直接把整批判定为失败。
 */
export async function createQuestionImportBatch(
  bankId: string,
  file: File,
  createdById: string,
) {
  await assertBankExists(bankId);

  if (file.size > EXCEL_MAX_SIZE_BYTES) {
    throw new Error("Excel 文件过大，请控制在 5MB 以内");
  }

  if (!isAllowedExcelFile(file.name)) {
    throw new Error("仅支持 xlsx、xls、csv 文件");
  }

  if (!isAllowedExcelMimeType(file.type)) {
    throw new Error("Excel 文件 MIME 类型不受支持");
  }

  const storagePath = await saveUploadedFile(file, "imports");
  const batch = await prisma.questionImportBatch.create({
    data: {
      bankId,
      createdById,
      fileName: file.name,
      storagePath,
      status: QuestionImportBatchStatus.PENDING,
    },
  });

  await enqueueJob(JobType.IMPORT_QUESTIONS, { batchId: batch.id });
  return batch;
}

export async function getQuestionImportBatchDetail(batchId: string) {
  return buildQuestionImportBatchDetail(batchId);
}

export async function listQuestionImportBatchesForAdmin(
  bankId: string,
  page: number,
  pageSize: number,
) {
  const total = await prisma.questionImportBatch.count({
    where: {
      bankId,
    },
  });
  const {
    page: safePage,
    pageSize: safePageSize,
    skip,
    take,
  } = resolvePagination(page, pageSize, total);

  const items = await prisma.questionImportBatch.findMany({
    where: {
      bankId,
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
    select: {
      id: true,
      fileName: true,
      sourceSheetName: true,
      templateType: true,
      status: true,
      draftCount: true,
      totalSourceRows: true,
      processedSourceRows: true,
      totalChunks: true,
      processedChunks: true,
      currentConcurrency: true,
      lastError: true,
      createdAt: true,
      parsedAt: true,
      confirmedAt: true,
    },
  });

  return {
    items: items.map(mapBatchSummary),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getQuestionImportBatchListMetaForAdmin(
  bankId: string,
  page: number,
  pageSize: number,
) {
  const total = await prisma.questionImportBatch.count({
    where: {
      bankId,
    },
  });
  const { page: safePage, pageSize: safePageSize } = resolvePagination(
    page,
    pageSize,
    total,
  );

  return {
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function deleteQuestionImportDraft(
  batchId: string,
  draftId: string,
) {
  await prisma.$transaction(async (tx) => {
    const batch = await tx.questionImportBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
      },
    });

    if (!batch) {
      throw new Error("导题批次不存在");
    }

    if (batch.status !== QuestionImportBatchStatus.READY) {
      throw new Error("当前批次不允许删除草稿");
    }

    await tx.questionImportDraft.updateMany({
      where: {
        id: draftId,
        batchId,
      },
      data: {
        isDeleted: true,
      },
    });

    await syncBatchDraftCount(tx, batchId);
  });

  return buildQuestionImportBatchDetail(batchId);
}

export async function deleteQuestionImportDrafts(
  batchId: string,
  input: DeleteImportDraftsInput,
) {
  await prisma.$transaction(async (tx) => {
    const batch = await tx.questionImportBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
      },
    });

    if (!batch) {
      throw new Error("导题批次不存在");
    }

    if (batch.status !== QuestionImportBatchStatus.READY) {
      throw new Error("当前批次不允许删除草稿");
    }

    await tx.questionImportDraft.updateMany({
      where: {
        batchId,
        id: {
          in: input.draftIds,
        },
      },
      data: {
        isDeleted: true,
      },
    });

    await syncBatchDraftCount(tx, batchId);
  });

  return buildQuestionImportBatchDetail(batchId);
}

export async function confirmQuestionImportBatch(
  batchId: string,
  userId: string,
) {
  const batch = await prisma.questionImportBatch.findUnique({
    where: { id: batchId },
    include: {
      drafts: {
        where: {
          isDeleted: false,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  if (!batch) {
    throw new Error("导题批次不存在");
  }

  if (batch.status !== QuestionImportBatchStatus.READY) {
    throw new Error("当前批次不允许确认导入");
  }

  if (batch.drafts.length === 0) {
    throw new Error("当前批次没有可导入的题目草稿");
  }

  const existingQuestions = await prisma.question.findMany({
    where: {
      bankId: batch.bankId,
    },
    select: {
      sortOrder: true,
    },
  });
  const usedSortOrders = new Set(
    existingQuestions.map((item) => item.sortOrder),
  );
  let nextSortOrder =
    existingQuestions.reduce(
      (maxValue, item) => Math.max(maxValue, item.sortOrder),
      0,
    ) + 1;

  const preparedDrafts = batch.drafts.map((draft) => {
    const payload = normalizeQuestionInput(
      questionImportDraftSchema.parse({
        type: draft.type,
        stem: draft.stem,
        options: questionOptionSchema.array().parse(draft.options),
        correctAnswers: parseStringArray(draft.correctAnswers),
        analysis: draft.analysis,
        lawSource: draft.lawSource,
        sortOrder: draft.sortOrder,
        sourceLabel: draft.sourceLabel,
        sourceContent: draft.sourceContent,
        sourceRowNumbers: parseNumberArray(draft.sourceRowNumbers),
      }),
    );

    let finalSortOrder = payload.sortOrder;
    if (finalSortOrder <= 0 || usedSortOrders.has(finalSortOrder)) {
      while (usedSortOrders.has(nextSortOrder)) {
        nextSortOrder += 1;
      }
      finalSortOrder = nextSortOrder;
      nextSortOrder += 1;
    }
    usedSortOrders.add(finalSortOrder);

    return {
      draftId: draft.id,
      originalSortOrder: draft.sortOrder,
      finalSortOrder,
      sourceRowNumbers: parseNumberArray(draft.sourceRowNumbers),
      createData: {
        bankId: batch.bankId,
        ...payload,
        sortOrder: finalSortOrder,
        createdById: userId,
        updatedById: userId,
      },
    };
  });

  const matchedSortOrderMap = new Map<number, number[]>();
  for (const draft of preparedDrafts) {
    for (const rowNumber of draft.sourceRowNumbers) {
      const matchedSortOrders = matchedSortOrderMap.get(rowNumber) ?? [];
      matchedSortOrders.push(draft.finalSortOrder);
      matchedSortOrderMap.set(rowNumber, matchedSortOrders);
    }
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const locked = await tx.questionImportBatch.updateMany({
        where: {
          id: batchId,
          status: QuestionImportBatchStatus.READY,
        },
        data: {
          status: QuestionImportBatchStatus.PROCESSING,
        },
      });

      if (locked.count === 0) {
        throw new Error("当前批次不允许确认导入");
      }

      const questionIds: string[] = [];
      for (const chunk of chunkArray(preparedDrafts, questionCreateChunkSize)) {
        const createdQuestions = await tx.question.createManyAndReturn({
          data: chunk.map((item) => item.createData),
          select: {
            id: true,
          },
        });
        questionIds.push(...createdQuestions.map((item) => item.id));
      }

      await tx.questionImportBatch.update({
        where: { id: batchId },
        data: {
          status: QuestionImportBatchStatus.CONFIRMED,
          confirmedAt: new Date(),
          lastError: null,
        },
      });

      return {
        bankId: batch.bankId,
        questionIds,
      };
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  );

  try {
    for (const draft of preparedDrafts) {
      if (draft.finalSortOrder !== draft.originalSortOrder) {
        await prisma.questionImportDraft.update({
          where: {
            id: draft.draftId,
          },
          data: {
            sortOrder: draft.finalSortOrder,
          },
        });
      }
    }

    for (const [rowNumber, matchedSortOrders] of matchedSortOrderMap) {
      await prisma.questionImportSourceRow.updateMany({
        where: {
          batchId,
          rowNumber,
        },
        data: {
          matchedSortOrders: Array.from(new Set(matchedSortOrders)).sort(
            (left, right) => left - right,
          ),
        },
      });
    }

    await refreshQuestionEmbeddings(result.questionIds);

    await enqueueJob(JobType.REBUILD_QUESTION_MATCH, {
      bankId: result.bankId,
      questionIds: result.questionIds,
    });
  } catch (error) {
    logger.error(
      {
        batchId,
        bankId: result.bankId,
        questionCount: result.questionIds.length,
        error,
      },
      "导题确认后的后处理失败",
    );

    await prisma.questionImportBatch.update({
      where: { id: batchId },
      data: {
        lastError:
          error instanceof Error
            ? `题目已导入，但后处理失败：${error.message}`
            : "题目已导入，但后处理失败",
      },
    });
  }

  return buildQuestionImportBatchDetail(batchId);
}

export async function markQuestionImportBatchFailed(
  batchId: string,
  message: string,
) {
  await prisma.questionImportBatch.updateMany({
    where: {
      id: batchId,
      status: {
        not: QuestionImportBatchStatus.CONFIRMED,
      },
    },
    data: {
      status: QuestionImportBatchStatus.FAILED,
      parsedAt: new Date(),
      currentConcurrency: 0,
      lastError: message.trim() || "导题解析失败",
    },
  });
}

export async function processQuestionImportBatch(batchId: string) {
  const batch = await prisma.questionImportBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      bankId: true,
      storagePath: true,
    },
  });

  if (!batch) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.questionImportDraft.deleteMany({
      where: {
        batchId,
      },
    });

    await tx.questionImportSourceRow.deleteMany({
      where: {
        batchId,
      },
    });

    await tx.questionImportBatch.update({
      where: { id: batchId },
      data: {
        status: QuestionImportBatchStatus.PROCESSING,
        lastError: null,
        parsedAt: null,
        confirmedAt: null,
        templateType: null,
        sourceSheetName: null,
        draftCount: 0,
        totalSourceRows: 0,
        processedSourceRows: 0,
        totalChunks: 0,
        processedChunks: 0,
        currentConcurrency: 0,
      },
    });
  });

  try {
    const buffer = await readStoredFile(batch.storagePath);
    const parsed = await parseWorkbookToDrafts(batch.bankId, batchId, buffer);

    await prisma.$transaction(async (tx) => {
      if (!parsed.persistedDuringParsing && parsed.drafts.length > 0) {
        await tx.questionImportDraft.createMany({
          data: parsed.drafts.map((draft) => ({
            batchId,
            type: draft.type,
            stem: draft.stem,
            options: draft.options,
            correctAnswers: draft.correctAnswers,
            analysis: draft.analysis || null,
            lawSource: draft.lawSource || null,
            sortOrder: draft.sortOrder,
            sourceLabel:
              draft.sourceLabel || buildSourceRowLabel(draft.sourceRowNumbers),
            sourceContent: draft.sourceContent || null,
            sourceRowNumbers: draft.sourceRowNumbers,
          })),
        });
      }

      if (!parsed.persistedDuringParsing && parsed.sourceRows.length > 0) {
        await tx.questionImportSourceRow.createMany({
          data: parsed.sourceRows.map((row) => ({
            batchId,
            rowNumber: row.rowNumber,
            status: row.status,
            content: row.content,
            reason: row.reason,
            matchedSortOrders: row.matchedSortOrders,
          })),
        });
      }

      await tx.questionImportBatch.update({
        where: { id: batchId },
        data: {
          sourceSheetName: parsed.sourceSheetName,
          templateType: parsed.templateType,
          status:
            parsed.drafts.length > 0
              ? QuestionImportBatchStatus.READY
              : QuestionImportBatchStatus.FAILED,
          lastError:
            parsed.drafts.length > 0
              ? null
              : "未识别出可确认的题目，请检查来源行判定结果",
          parsedAt: new Date(),
          draftCount: parsed.drafts.length,
          currentConcurrency: 0,
        },
      });
    });
  } catch (error) {
    await markQuestionImportBatchFailed(
      batchId,
      error instanceof Error ? error.message : "导题解析失败",
    );

    throw error;
  }
}

import { JobType, Prisma, QuestionType } from "@prisma/client";
import * as XLSX from "xlsx";

import {
  questionImportRowSchema,
  questionListQuerySchema,
  questionOptionSchema,
  upsertQuestionSchema,
  type QuestionImportRow,
  type UpsertQuestionInput,
} from "@/shared/schemas/question";
import type { QuestionListItem } from "@/shared/types/domain";
import { resolvePagination } from "@/shared/utils/pagination";
import { prisma } from "@/server/db/client";
import { enqueueJob } from "@/server/repositories/job-repository";
import { refreshQuestionEmbedding } from "@/server/services/matching-service";

function normalizeQuestionType(type: QuestionImportRow["question_type"]) {
  switch (type) {
    case "single":
      return QuestionType.SINGLE;
    case "multiple":
      return QuestionType.MULTIPLE;
    case "judge":
      return QuestionType.JUDGE;
    default:
      return QuestionType.SINGLE;
  }
}

function mapImportRowToQuestionInput(row: QuestionImportRow): UpsertQuestionInput {
  const options = ["a", "b", "c", "d", "e", "f"]
    .map((suffix, index) => {
      const value = row[`option_${suffix}` as keyof QuestionImportRow];
      return value
        ? {
            label: String.fromCharCode(65 + index),
            text: String(value),
          }
        : null;
    })
    .filter((item): item is { label: string; text: string } => Boolean(item));

  const correctAnswers = row.correct_answer
    .split(/[、,，\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return upsertQuestionSchema.parse({
    type: normalizeQuestionType(row.question_type),
    stem: row.stem,
    options,
    correctAnswers,
    analysis: row.analysis || null,
    lawSource: row.law_source || null,
    sortOrder: row.sort_order,
  });
}

function normalizeQuestionInput(input: UpsertQuestionInput) {
  return {
    type: input.type,
    stem: input.stem.trim(),
    options: input.options.map((item) => ({
      label: item.label.trim().toUpperCase(),
      text: item.text.trim(),
    })),
    correctAnswers: input.correctAnswers.map((item) => item.trim().toUpperCase()),
    analysis: input.analysis?.trim() || null,
    lawSource: input.lawSource?.trim() || null,
    sortOrder: input.sortOrder,
  };
}

export async function listQuestionsForAdmin(bankId: string, rawQuery: unknown) {
  const query = questionListQuerySchema.parse(rawQuery);
  const { skip, take, page, pageSize } = resolvePagination(query.page, query.pageSize);

  const where: Prisma.QuestionWhereInput = {
    bankId,
    ...(query.keyword
      ? {
          stem: {
            contains: query.keyword,
            mode: "insensitive",
          },
        }
      : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.lawSource
      ? {
          lawSource: {
            contains: query.lawSource,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.question.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        type: true,
        stem: true,
        options: true,
        correctAnswers: true,
        analysis: true,
        lawSource: true,
        sortOrder: true,
        updatedAt: true,
      },
    }),
    prisma.question.count({ where }),
  ]);

  return {
    items: items.map(
      (item) =>
        ({
          ...item,
          options: questionOptionSchema.array().parse(item.options),
          correctAnswers: ((item.correctAnswers as string[]) ?? []).map((answer) => String(answer)),
          updatedAt: item.updatedAt.toISOString(),
        }) satisfies QuestionListItem,
    ),
    total,
    page,
    pageSize,
  };
}

export async function createQuestion(bankId: string, input: UpsertQuestionInput) {
  const payload = normalizeQuestionInput(upsertQuestionSchema.parse(input));

  const question = await prisma.question.create({
    data: {
      bankId,
      ...payload,
    },
  });

  await refreshQuestionEmbedding(question.id);
  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, { bankId, questionIds: [question.id] });

  return question;
}

export async function updateQuestion(questionId: string, input: UpsertQuestionInput) {
  const payload = normalizeQuestionInput(upsertQuestionSchema.parse(input));

  const question = await prisma.question.update({
    where: { id: questionId },
    data: payload,
  });

  await refreshQuestionEmbedding(question.id);
  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, { bankId: question.bankId, questionIds: [question.id] });

  return question;
}

export async function deleteQuestion(questionId: string) {
  const question = await prisma.question.delete({
    where: { id: questionId },
  });

  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, { bankId: question.bankId });
  return question;
}

/**
功能说明：
将 Excel 题目表解析为标准题目输入，并完成题库内题目的批量导入。

业务背景：
后台导题是题库维护的主要入口，管理员需要批量导入题目，并允许按题目排序覆盖已有内容。

核心逻辑：
以 sortOrder 作为题库内的幂等键，逐行校验模板数据后执行 upsert，导入结束后统一刷新题目向量和法条匹配任务。

关键约束：
导入行必须符合固定模板；任一行校验失败会终止整个导入，避免题库出现部分成功、部分失败的中间状态。
*/
export async function importQuestionsFromWorkbook(bankId: string, buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Excel 文件中不存在可用工作表");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows = rawRows.map((row, index) => {
    try {
      return questionImportRowSchema.parse(row);
    } catch (error) {
      throw new Error(`第 ${index + 2} 行格式错误：${(error as Error).message}`);
    }
  });

  const questionIds = await prisma.$transaction(async (transaction) => {
    const ids: string[] = [];

    for (const row of rows) {
      const payload = mapImportRowToQuestionInput(row);
      const normalized = normalizeQuestionInput(payload);

      const question = await transaction.question.upsert({
        where: {
          bankId_sortOrder: {
            bankId,
            sortOrder: normalized.sortOrder,
          },
        },
        update: normalized,
        create: {
          bankId,
          ...normalized,
        },
      });

      ids.push(question.id);
    }

    return ids;
  });

  for (const questionId of questionIds) {
    await refreshQuestionEmbedding(questionId);
  }

  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, { bankId, questionIds });

  return {
    importedCount: questionIds.length,
    questionIds,
  };
}

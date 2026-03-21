import { JobType, Prisma } from "@prisma/client";

import {
  questionListQuerySchema,
  questionOptionSchema,
  upsertQuestionSchema,
  type UpsertQuestionInput,
} from "@/shared/schemas/question";
import type { QuestionListItem } from "@/shared/types/domain";
import { resolvePagination } from "@/shared/utils/pagination";
import { prisma } from "@/server/db/client";
import { enqueueJob } from "@/server/repositories/job-repository";
import { refreshQuestionEmbedding } from "@/server/services/matching-service";
import { normalizeQuestionInput } from "@/server/services/question-payload";

export async function listQuestionsForAdmin(bankId: string, rawQuery: unknown) {
  const query = questionListQuerySchema.parse(rawQuery);

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

  const [total, aggregate] = await prisma.$transaction([
    prisma.question.count({ where }),
    prisma.question.aggregate({
      where: { bankId },
      _max: {
        sortOrder: true,
      },
    }),
  ]);
  const { skip, take, page, pageSize } = resolvePagination(
    query.page,
    query.pageSize,
    total,
  );

  const items = await prisma.question.findMany({
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
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          displayName: true,
        },
      },
      updatedBy: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return {
    items: items.map(
      (item) =>
        ({
          id: item.id,
          type: item.type,
          stem: item.stem,
          options: questionOptionSchema.array().parse(item.options),
          correctAnswers: ((item.correctAnswers as string[]) ?? []).map(
            (answer) => String(answer),
          ),
          analysis: item.analysis,
          lawSource: item.lawSource,
          sortOrder: item.sortOrder,
          createdByName: item.createdBy?.displayName ?? null,
          updatedByName: item.updatedBy?.displayName ?? null,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }) satisfies QuestionListItem,
    ),
    total,
    page,
    pageSize,
    nextSortOrder: (aggregate._max.sortOrder ?? 0) + 1,
  };
}

export async function createQuestion(
  bankId: string,
  input: UpsertQuestionInput,
  userId: string,
) {
  const payload = normalizeQuestionInput(upsertQuestionSchema.parse(input));

  const question = await prisma.question.create({
    data: {
      bankId,
      ...payload,
      createdById: userId,
      updatedById: userId,
    },
  });

  await refreshQuestionEmbedding(question.id);
  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, {
    bankId,
    questionIds: [question.id],
  });

  return question;
}

export async function updateQuestion(
  questionId: string,
  input: UpsertQuestionInput,
  userId: string,
) {
  const payload = normalizeQuestionInput(upsertQuestionSchema.parse(input));

  const question = await prisma.question.update({
    where: { id: questionId },
    data: {
      ...payload,
      updatedById: userId,
    },
  });

  await refreshQuestionEmbedding(question.id);
  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, {
    bankId: question.bankId,
    questionIds: [question.id],
  });

  return question;
}

export async function deleteQuestion(questionId: string) {
  const question = await prisma.question.delete({
    where: { id: questionId },
  });

  await enqueueJob(JobType.REBUILD_QUESTION_MATCH, { bankId: question.bankId });
  return question;
}

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { MATCH_SCORE_THRESHOLD } from "@/shared/constants/app";
import { questionOptionSchema } from "@/shared/schemas/question";
import { prisma } from "@/server/db/client";
import { embedTexts, vectorToSqlLiteral } from "@/server/services/ai-service";

function parseQuestionOptions(value: Prisma.JsonValue) {
  return questionOptionSchema.array().parse(value);
}

function parseCorrectAnswers(value: Prisma.JsonValue) {
  return z.array(z.string()).parse(value);
}

export function buildQuestionEmbeddingText(input: {
  stem: string;
  options: Prisma.JsonValue;
  correctAnswers: Prisma.JsonValue;
  lawSource?: string | null;
}) {
  const options = parseQuestionOptions(input.options)
    .map((item) => `${item.label}. ${item.text}`)
    .join("\n");
  const answers = parseCorrectAnswers(input.correctAnswers).join("、");

  return [
    `题干：${input.stem}`,
    `选项：${options}`,
    `正确答案：${answers}`,
    input.lawSource ? `法律来源：${input.lawSource}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function saveQuestionEmbedding(
  questionId: string,
  vector: number[],
) {
  const vectorLiteral = vectorToSqlLiteral(vector);
  await prisma.$executeRaw`UPDATE "Question" SET "embedding" = ${vectorLiteral}::vector, "embeddingUpdatedAt" = NOW() WHERE "id" = ${questionId}`;
}

export async function saveStatuteChunkEmbedding(
  chunkId: string,
  vector: number[],
) {
  const vectorLiteral = vectorToSqlLiteral(vector);
  await prisma.$executeRaw`UPDATE "StatuteChunk" SET "embedding" = ${vectorLiteral}::vector, "embeddingUpdatedAt" = NOW() WHERE "id" = ${chunkId}`;
}

export async function refreshQuestionEmbedding(questionId: string) {
  await refreshQuestionEmbeddings([questionId]);
}

export async function refreshQuestionEmbeddings(questionIds: string[]) {
  if (questionIds.length === 0) {
    return;
  }

  const questions = await prisma.question.findMany({
    where: {
      id: {
        in: questionIds,
      },
    },
    select: {
      id: true,
      stem: true,
      options: true,
      correctAnswers: true,
      lawSource: true,
    },
  });

  if (questions.length === 0) {
    return;
  }

  const vectors = await embedTexts(
    questions.map((question) =>
      buildQuestionEmbeddingText({
        stem: question.stem,
        options: question.options,
        correctAnswers: question.correctAnswers,
        lawSource: question.lawSource,
      }),
    ),
  );

  await Promise.all(
    questions.map((question, index) =>
      saveQuestionEmbedding(question.id, vectors[index]),
    ),
  );
}

/**
功能说明：
根据题目向量在同题库法条切片中选择最相关片段，并将结果持久化到缓存表。

业务背景：
前台答题页需要稳定展示法条匹配片段，不能在用户提交答案时实时调用向量检索。

核心逻辑：
先确保题目向量存在，再使用 pgvector 检索当前题库下最接近的法条切片，最后写入 question_statute_match。

关键约束：
当前仅缓存单条最佳结果；若题库暂无可用切片，则删除已有缓存，避免展示过期法条。
*/
export async function rebuildQuestionMatchesForBank(
  bankId: string,
  questionIds?: string[],
) {
  const questions = await prisma.question.findMany({
    where: {
      bankId,
      ...(questionIds ? { id: { in: questionIds } } : {}),
    },
    select: {
      id: true,
      embeddingUpdatedAt: true,
    },
  });

  const chunkCount = await prisma.statuteChunk.count({
    where: {
      bankId,
      embeddingUpdatedAt: {
        not: null,
      },
    },
  });

  if (chunkCount === 0) {
    await prisma.questionStatuteMatch.deleteMany({
      where: {
        bankId,
        ...(questionIds ? { questionId: { in: questionIds } } : {}),
      },
    });
    return;
  }

  const missingEmbeddingQuestionIds = questions
    .filter((question) => !question.embeddingUpdatedAt)
    .map((question) => question.id);

  if (missingEmbeddingQuestionIds.length > 0) {
    await refreshQuestionEmbeddings(missingEmbeddingQuestionIds);
  }

  for (const question of questions) {
    const vectorRows = await prisma.$queryRaw<Array<{ embedding: string }>>`
      SELECT "embedding"::text AS "embedding" FROM "Question" WHERE "id" = ${question.id} AND "embedding" IS NOT NULL
    `;

    const vector = vectorRows[0]?.embedding;
    if (!vector) {
      continue;
    }

    const bestChunk = await prisma.$queryRaw<
      Array<{ id: string; content: string; score: number }>
    >`
      SELECT "id", "content", 1 - ("embedding" <=> ${vector}::vector) AS "score"
      FROM "StatuteChunk"
      WHERE "bankId" = ${bankId} AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${vector}::vector ASC
      LIMIT 1
    `;

    const matchedChunk = bestChunk[0];
    if (!matchedChunk) {
      continue;
    }

    await prisma.questionStatuteMatch.upsert({
      where: {
        questionId: question.id,
      },
      update: {
        bankId,
        chunkId: matchedChunk.id,
        score: matchedChunk.score,
        excerpt: matchedChunk.content.slice(0, 220),
      },
      create: {
        bankId,
        questionId: question.id,
        chunkId: matchedChunk.id,
        score: matchedChunk.score,
        excerpt: matchedChunk.content.slice(0, 220),
      },
    });
  }
}

export function resolveMatchedExcerpt(
  match: { excerpt: string; score: number } | null,
) {
  if (!match || match.score < MATCH_SCORE_THRESHOLD) {
    return null;
  }

  return {
    excerpt: match.excerpt,
    score: match.score,
  };
}

import {
  PracticeMode,
  PracticeSessionStatus,
  PracticeSourceType,
  Prisma,
} from "@prisma/client";

import { MATCH_SCORE_THRESHOLD, WRONG_BOOK_RECOVERY_COUNT } from "@/shared/constants/app";
import {
  createPracticeSessionSchema,
  submitPracticeAnswerSchema,
  type CreatePracticeSessionInput,
  type SubmitPracticeAnswerInput,
} from "@/shared/schemas/practice";
import { questionOptionSchema } from "@/shared/schemas/question";
import type { PracticeSessionView } from "@/shared/types/domain";
import { isAnswerCorrect, normalizeAnswerValues } from "@/shared/utils/answers";
import { resolveWrongBookState } from "@/shared/utils/wrong-book";
import { prisma } from "@/server/db/client";
import { getSessionWithCurrentQuestion } from "@/server/repositories/practice-repository";

function parseQuestionOptions(value: Prisma.JsonValue) {
  return questionOptionSchema.array().parse(value);
}

function parseCorrectAnswers(value: Prisma.JsonValue) {
  return (value as Prisma.JsonArray).map((item) => String(item));
}

function shuffle<T>(items: T[]) {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
  }
  return cloned;
}

function orderQuestionIds(questionIds: Array<{ id: string; sortOrder: number }>, practiceMode: PracticeMode) {
  if (practiceMode === PracticeMode.REVERSE) {
    return [...questionIds].sort((left, right) => right.sortOrder - left.sortOrder);
  }

  if (practiceMode === PracticeMode.RANDOM) {
    return shuffle(questionIds);
  }

  return [...questionIds].sort((left, right) => left.sortOrder - right.sortOrder);
}

function buildPracticeSessionView(
  session: NonNullable<Awaited<ReturnType<typeof getSessionWithCurrentQuestion>>>,
): PracticeSessionView {
  const currentItem = session.items[session.currentIndex] ?? null;
  const latestAttempt = currentItem?.attempts[0] ?? null;
  const currentQuestion = currentItem
    ? {
        itemId: currentItem.id,
        questionId: currentItem.question.id,
        sequence: currentItem.sequence,
        type: currentItem.question.type,
        stem: currentItem.question.stem,
        options: parseQuestionOptions(currentItem.question.options),
        selectedAnswers: latestAttempt
          ? ((latestAttempt.selectedAnswers as Prisma.JsonArray).map((item) => String(item)) as string[])
          : [],
        correctAnswers: parseCorrectAnswers(currentItem.question.correctAnswers),
        analysis: currentItem.question.analysis,
        lawSource: currentItem.question.lawSource,
        isCorrect: latestAttempt?.isCorrect ?? null,
        matchedExcerpt:
          currentItem.question.statuteMatch && currentItem.question.statuteMatch.score >= MATCH_SCORE_THRESHOLD
            ? currentItem.question.statuteMatch.excerpt
            : null,
        matchedScore:
          currentItem.question.statuteMatch && currentItem.question.statuteMatch.score >= MATCH_SCORE_THRESHOLD
            ? currentItem.question.statuteMatch.score
            : null,
      }
    : null;

  return {
    id: session.id,
    bankId: session.bankId,
    bankName: session.bank.name,
    sourceType: session.sourceType,
    practiceMode: session.practiceMode,
    status: session.status,
    currentIndex: session.currentIndex,
    totalCount: session.totalCount,
    submittedCount: session.submittedCount,
    currentQuestion,
  };
}

async function getQuestionIdsForPractice(userId: string, bankId: string, sourceType: PracticeSourceType) {
  if (sourceType === PracticeSourceType.WRONG_BOOK) {
    const stats = await prisma.userQuestionStat.findMany({
      where: {
        userId,
        bankId,
        isInWrongBook: true,
      },
      include: {
        question: {
          select: {
            id: true,
            sortOrder: true,
          },
        },
      },
    });

    return stats.map((item) => item.question);
  }

  return prisma.question.findMany({
    where: { bankId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      sortOrder: true,
    },
  });
}

export async function getResumeSessionId(userId: string, bankId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      userId,
      bankId,
      sourceType: PracticeSourceType.NORMAL,
      status: PracticeSessionStatus.IN_PROGRESS,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  return session?.id ?? null;
}

export async function createPracticeSession(
  userId: string,
  bankId: string,
  input: CreatePracticeSessionInput,
) {
  const payload = createPracticeSessionSchema.parse(input);
  const bank = await prisma.questionBank.findFirst({
    where: {
      id: bankId,
      status: "ACTIVE",
    },
  });

  if (!bank) {
    throw new Error("题库不存在或已停用");
  }

  const orderedQuestions = orderQuestionIds(
    await getQuestionIdsForPractice(userId, bankId, payload.sourceType),
    payload.practiceMode,
  );

  if (orderedQuestions.length === 0) {
    throw new Error(payload.sourceType === PracticeSourceType.WRONG_BOOK ? "当前没有错题可练习" : "当前题库还没有可练习的题目");
  }

  await prisma.practiceSession.updateMany({
    where: {
      userId,
      bankId,
      sourceType: payload.sourceType,
      status: PracticeSessionStatus.IN_PROGRESS,
    },
    data: {
      status: PracticeSessionStatus.ABANDONED,
    },
  });

  const session = await prisma.practiceSession.create({
    data: {
      userId,
      bankId,
      sourceType: payload.sourceType,
      practiceMode: payload.practiceMode,
      totalCount: orderedQuestions.length,
      items: {
        createMany: {
          data: orderedQuestions.map((question, index) => ({
            questionId: question.id,
            sequence: index,
          })),
        },
      },
    },
  });

  return session;
}

export async function getPracticeSessionView(userId: string, sessionId: string) {
  const session = await getSessionWithCurrentQuestion(sessionId, userId);

  if (!session) {
    throw new Error("练习会话不存在");
  }

  return buildPracticeSessionView(session);
}

/**
功能说明：
提交当前题目的答案，并同步刷新练习会话与错题本状态。

业务背景：
学员在练习中提交答案后，系统需要一次性完成答题记录落库、题目统计更新和会话推进。

核心逻辑：
以事务包裹答题记录、用户题目统计和练习会话更新，保证一次提交后的学习状态保持一致。

关键约束：
同一道题只接受首次提交；错题本移出规则依赖连续答对次数；最后一题提交后会直接完成会话。
*/
export async function submitCurrentAnswer(
  userId: string,
  sessionId: string,
  input: SubmitPracticeAnswerInput,
) {
  const payload = submitPracticeAnswerSchema.parse(input);
  const session = await getSessionWithCurrentQuestion(sessionId, userId);

  if (!session) {
    throw new Error("练习会话不存在");
  }

  const currentItem = session.items[session.currentIndex];
  if (!currentItem) {
    throw new Error("当前会话没有待答题目");
  }

  const existingAttempt = currentItem.attempts[0];
  if (existingAttempt) {
    return buildPracticeSessionView(session);
  }

  const selectedAnswers = normalizeAnswerValues(payload.selectedAnswers);
  const correctAnswers = parseCorrectAnswers(currentItem.question.correctAnswers);
  const isCorrect = isAnswerCorrect(currentItem.question.type, selectedAnswers, correctAnswers);
  const isLastQuestion = session.currentIndex >= session.totalCount - 1;

  await prisma.$transaction(async (transaction) => {
    await transaction.practiceAttempt.create({
      data: {
        sessionId: session.id,
        sessionItemId: currentItem.id,
        userId,
        bankId: session.bankId,
        questionId: currentItem.question.id,
        selectedAnswers,
        isCorrect,
      },
    });

    const currentStat = await transaction.userQuestionStat.findUnique({
      where: {
        userId_bankId_questionId: {
          userId,
          bankId: session.bankId,
          questionId: currentItem.question.id,
        },
      },
    });

    if (currentStat) {
      const nextWrongBookState = resolveWrongBookState(
        {
          isInWrongBook: currentStat.isInWrongBook,
          consecutiveCorrectInWrongBook: currentStat.consecutiveCorrectInWrongBook,
        },
        isCorrect,
        WRONG_BOOK_RECOVERY_COUNT,
      );

      await transaction.userQuestionStat.update({
        where: {
          id: currentStat.id,
        },
        data: {
          totalAttempts: {
            increment: 1,
          },
          correctAttempts: isCorrect
            ? {
                increment: 1,
              }
            : undefined,
          consecutiveCorrectInWrongBook: nextWrongBookState.consecutiveCorrectInWrongBook,
          isInWrongBook: nextWrongBookState.isInWrongBook,
          lastResultCorrect: isCorrect,
          lastAnsweredAt: new Date(),
        },
      });
    } else {
      await transaction.userQuestionStat.create({
        data: {
          userId,
          bankId: session.bankId,
          questionId: currentItem.question.id,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          consecutiveCorrectInWrongBook: 0,
          isInWrongBook: !isCorrect,
          lastResultCorrect: isCorrect,
          lastAnsweredAt: new Date(),
        },
      });
    }

    await transaction.practiceSession.update({
      where: {
        id: session.id,
      },
      data: {
        submittedCount: {
          increment: 1,
        },
        status: isLastQuestion ? PracticeSessionStatus.COMPLETED : PracticeSessionStatus.IN_PROGRESS,
        completedAt: isLastQuestion ? new Date() : null,
        lastAccessedAt: new Date(),
      },
    });
  });

  return getPracticeSessionView(userId, sessionId);
}

export async function moveToNextQuestion(userId: string, sessionId: string) {
  const session = await getSessionWithCurrentQuestion(sessionId, userId);

  if (!session) {
    throw new Error("练习会话不存在");
  }

  const currentItem = session.items[session.currentIndex];
  if (!currentItem) {
    return buildPracticeSessionView(session);
  }

  if (!currentItem.attempts[0]) {
    throw new Error("请先提交当前题目");
  }

  if (session.currentIndex >= session.totalCount - 1) {
    await prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        currentIndex: session.totalCount,
        status: PracticeSessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    return getPracticeSessionView(userId, sessionId);
  }

  await prisma.practiceSession.update({
    where: { id: session.id },
    data: {
      currentIndex: {
        increment: 1,
      },
      lastAccessedAt: new Date(),
    },
  });

  return getPracticeSessionView(userId, sessionId);
}

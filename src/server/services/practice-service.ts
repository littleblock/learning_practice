import {
  PracticeMode,
  PracticeSessionStatus,
  PracticeSourceType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import {
  MATCH_SCORE_THRESHOLD,
  WRONG_BOOK_RECOVERY_COUNT,
} from "@/shared/constants/app";
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
  return z.array(z.string()).parse(value);
}

function shuffle<T>(items: T[]) {
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
  }

  return cloned;
}

function orderQuestionIds(
  questionIds: Array<{ id: string; sortOrder: number }>,
  practiceMode: PracticeMode,
) {
  if (practiceMode === PracticeMode.REVERSE) {
    return [...questionIds].sort(
      (left, right) => right.sortOrder - left.sortOrder,
    );
  }

  if (practiceMode === PracticeMode.RANDOM) {
    return shuffle(questionIds);
  }

  return [...questionIds].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}

function buildPracticeSessionView(
  session: NonNullable<
    Awaited<ReturnType<typeof getSessionWithCurrentQuestion>>
  >,
): PracticeSessionView {
  const currentItem = session.currentItem;
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
          ? z.array(z.string()).parse(latestAttempt.selectedAnswers)
          : [],
        correctAnswers: parseCorrectAnswers(
          currentItem.question.correctAnswers,
        ),
        analysis: currentItem.question.analysis,
        lawSource: currentItem.question.lawSource,
        isCorrect: latestAttempt?.isCorrect ?? null,
        matchedExcerpt:
          currentItem.question.statuteMatch &&
          currentItem.question.statuteMatch.score >= MATCH_SCORE_THRESHOLD
            ? currentItem.question.statuteMatch.excerpt
            : null,
        matchedScore:
          currentItem.question.statuteMatch &&
          currentItem.question.statuteMatch.score >= MATCH_SCORE_THRESHOLD
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

interface AttemptHistoryItem {
  isCorrect: boolean;
  submittedAt: Date;
}

/**
 * 功能说明：
 * 根据题目的最终作答记录重算用户题目统计，确保同一会话内改答不会重复累计。
 *
 * 业务背景：
 * 学员支持返回上一题修改答案后，统计口径必须以每个会话题目的最终结果为准，避免错题本和正确率被中间态污染。
 *
 * 核心逻辑：
 * 读取该用户在当前题目上的全部历史作答记录，按最终提交顺序重放错题本恢复规则，并同步覆盖统计快照。
 *
 * 关键约束：
 * 同一会话题目只保留一条最终作答记录；若历史记录为空则删除统计快照，避免残留脏数据。
 */
function summarizeAttemptHistory(attempts: AttemptHistoryItem[]) {
  let correctAttempts = 0;
  let wrongBookState = {
    isInWrongBook: false,
    consecutiveCorrectInWrongBook: 0,
  };

  for (const attempt of attempts) {
    if (attempt.isCorrect) {
      correctAttempts += 1;
    }

    wrongBookState = resolveWrongBookState(
      wrongBookState,
      attempt.isCorrect,
      WRONG_BOOK_RECOVERY_COUNT,
    );
  }

  const latestAttempt = attempts.at(-1) ?? null;

  return {
    totalAttempts: attempts.length,
    correctAttempts,
    consecutiveCorrectInWrongBook:
      wrongBookState.consecutiveCorrectInWrongBook,
    isInWrongBook: wrongBookState.isInWrongBook,
    lastResultCorrect: latestAttempt?.isCorrect ?? null,
    lastAnsweredAt: latestAttempt?.submittedAt ?? null,
  };
}

async function syncUserQuestionStat(
  transaction: Prisma.TransactionClient,
  userId: string,
  bankId: string,
  questionId: string,
) {
  const attempts = await transaction.practiceAttempt.findMany({
    where: {
      userId,
      bankId,
      questionId,
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    select: {
      isCorrect: true,
      submittedAt: true,
    },
  });

  if (attempts.length === 0) {
    await transaction.userQuestionStat.deleteMany({
      where: {
        userId,
        bankId,
        questionId,
      },
    });
    return;
  }

  const summary = summarizeAttemptHistory(attempts);

  await transaction.userQuestionStat.upsert({
    where: {
      userId_bankId_questionId: {
        userId,
        bankId,
        questionId,
      },
    },
    update: summary,
    create: {
      userId,
      bankId,
      questionId,
      ...summary,
    },
  });
}

async function getQuestionIdsForPractice(
  userId: string,
  bankId: string,
  sourceType: PracticeSourceType,
) {
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
    throw new Error(
      payload.sourceType === PracticeSourceType.WRONG_BOOK
        ? "当前没有错题可练习"
        : "当前题库还没有可练习的题目",
    );
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

export async function getPracticeSessionView(
  userId: string,
  sessionId: string,
) {
  const session = await getSessionWithCurrentQuestion(sessionId, userId);

  if (!session) {
    throw new Error("练习会话不存在");
  }

  return buildPracticeSessionView(session);
}

/**
 * 功能说明：
 * 提交当前题目的最终答案，并同步覆盖该题在当前会话中的保存结果。
 *
 * 业务背景：
 * 学员在移动端支持返回上一题修改答案，系统需要保证同一会话题目的最终结果可以被更新，同时不重复累计做题统计。
 *
 * 核心逻辑：
 * 使用会话题目唯一键对作答记录执行 upsert，再基于全部最终作答记录重算用户题目统计，并刷新当前会话的已提交数量。
 *
 * 关键约束：
 * 同一会话题目只保留一条最终答案；最后一题提交后仍保持会话进行中，只有显式继续下一步时才会完成整场练习。
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

  const currentItem = session.currentItem;
  if (!currentItem) {
    throw new Error("当前会话没有待答题目");
  }

  const selectedAnswers = normalizeAnswerValues(payload.selectedAnswers);
  const correctAnswers = parseCorrectAnswers(
    currentItem.question.correctAnswers,
  );
  const isCorrect = isAnswerCorrect(
    currentItem.question.type,
    selectedAnswers,
    correctAnswers,
  );
  const hasExistingAttempt = Boolean(currentItem.attempts[0]);
  const answeredAt = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.practiceAttempt.upsert({
      where: {
        sessionItemId: currentItem.id,
      },
      update: {
        selectedAnswers,
        isCorrect,
        submittedAt: answeredAt,
      },
      create: {
        sessionId: session.id,
        sessionItemId: currentItem.id,
        userId,
        bankId: session.bankId,
        questionId: currentItem.question.id,
        selectedAnswers,
        isCorrect,
        submittedAt: answeredAt,
      },
    });

    await syncUserQuestionStat(
      transaction,
      userId,
      session.bankId,
      currentItem.question.id,
    );

    await transaction.practiceSession.update({
      where: {
        id: session.id,
      },
      data: {
        ...(hasExistingAttempt
          ? {}
          : {
              submittedCount: {
                increment: 1,
              },
            }),
        status: PracticeSessionStatus.IN_PROGRESS,
        completedAt: null,
        lastAccessedAt: answeredAt,
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

  const currentItem = session.currentItem;
  if (!currentItem) {
    return buildPracticeSessionView(session);
  }

  if (!currentItem.attempts[0]) {
    throw new Error("请先提交当前题目");
  }

  if (session.currentIndex >= session.totalCount - 1) {
    const completedAt = new Date();
    await prisma.practiceSession.update({
      where: { id: session.id },
      data: {
        currentIndex: session.totalCount,
        status: PracticeSessionStatus.COMPLETED,
        completedAt,
        lastAccessedAt: completedAt,
      },
    });

    return getPracticeSessionView(userId, sessionId);
  }

  const accessedAt = new Date();
  await prisma.practiceSession.update({
    where: { id: session.id },
    data: {
      currentIndex: {
        increment: 1,
      },
      lastAccessedAt: accessedAt,
      completedAt: null,
    },
  });

  return getPracticeSessionView(userId, sessionId);
}

export async function moveToPreviousQuestion(userId: string, sessionId: string) {
  const session = await getSessionWithCurrentQuestion(sessionId, userId);

  if (!session) {
    throw new Error("练习会话不存在");
  }

  if (!session.currentItem || session.currentIndex <= 0) {
    return buildPracticeSessionView(session);
  }

  await prisma.practiceSession.update({
    where: { id: session.id },
    data: {
      currentIndex: {
        decrement: 1,
      },
      lastAccessedAt: new Date(),
    },
  });

  return getPracticeSessionView(userId, sessionId);
}

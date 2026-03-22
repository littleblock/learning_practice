import type {
  PracticeMode,
  PracticeSessionStatus,
  PracticeSourceType,
  Prisma,
  QuestionType,
} from "@prisma/client";

import { prisma } from "@/server/db/client";

export interface PracticeSessionWithCurrentQuestion {
  id: string;
  userId: string;
  bankId: string;
  sourceType: PracticeSourceType;
  practiceMode: PracticeMode;
  status: PracticeSessionStatus;
  currentIndex: number;
  totalCount: number;
  submittedCount: number;
  bank: {
    id: string;
    name: string;
  };
  currentItem: {
    id: string;
    sequence: number;
    question: {
      id: string;
      type: QuestionType;
      stem: string;
      options: Prisma.JsonValue;
      correctAnswers: Prisma.JsonValue;
      analysis: string | null;
      lawSource: string | null;
      statuteMatch: {
        score: number;
        excerpt: string;
      } | null;
    };
    attempts: Array<{
      selectedAnswers: Prisma.JsonValue;
      isCorrect: boolean;
    }>;
  } | null;
}

export async function getSessionWithCurrentQuestion(
  sessionId: string,
  userId: string,
): Promise<PracticeSessionWithCurrentQuestion | null> {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      bankId: true,
      sourceType: true,
      practiceMode: true,
      status: true,
      currentIndex: true,
      totalCount: true,
      submittedCount: true,
      bank: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const currentItem =
    session.currentIndex >= session.totalCount
      ? null
      : await prisma.practiceSessionItem.findFirst({
          where: {
            sessionId: session.id,
            sequence: session.currentIndex,
          },
          select: {
            id: true,
            sequence: true,
            question: {
              select: {
                id: true,
                type: true,
                stem: true,
                options: true,
                correctAnswers: true,
                analysis: true,
                lawSource: true,
                statuteMatch: {
                  select: {
                    score: true,
                    excerpt: true,
                  },
                },
              },
            },
            attempts: {
              orderBy: {
                submittedAt: "desc",
              },
              take: 1,
              select: {
                selectedAnswers: true,
                isCorrect: true,
              },
            },
          },
        });

  return {
    ...session,
    currentItem,
  };
}

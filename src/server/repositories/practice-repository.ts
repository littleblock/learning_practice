import { prisma } from "@/server/db/client";

export async function getSessionWithCurrentQuestion(sessionId: string, userId: string) {
  const session = await prisma.practiceSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: {
      bank: {
        select: {
          id: true,
          name: true,
        },
      },
      items: {
        orderBy: {
          sequence: "asc",
        },
        include: {
          question: {
            include: {
              statuteMatch: {
                include: {
                  chunk: true,
                },
              },
            },
          },
          attempts: {
            orderBy: {
              submittedAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
  });

  return session;
}

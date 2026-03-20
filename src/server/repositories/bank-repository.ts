import { BankStatus, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";

export async function listActiveBanks() {
  return prisma.questionBank.findMany({
    where: {
      status: BankStatus.ACTIVE,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      _count: {
        select: {
          questions: true,
        },
      },
    },
  });
}

export async function getBankById(bankId: string) {
  return prisma.questionBank.findUnique({
    where: { id: bankId },
  });
}

export async function listAdminBanks(where: Prisma.QuestionBankWhereInput, skip: number, take: number) {
  const [items, total] = await prisma.$transaction([
    prisma.questionBank.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      include: {
        _count: {
          select: {
            questions: true,
            statuteDocuments: true,
          },
        },
      },
    }),
    prisma.questionBank.count({ where }),
  ]);

  return { items, total };
}

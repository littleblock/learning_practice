import { BankStatus, Prisma, PracticeSourceType } from "@prisma/client";

import {
  bankListQuerySchema,
  createBankSchema,
  type CreateBankInput,
  updateBankSchema,
  type UpdateBankInput,
} from "@/shared/schemas/bank";
import type { BankSummary, WrongBookSummary } from "@/shared/types/domain";
import {
  buildBankCode,
  extractBankCodeSequence,
  getBankCodePeriod,
  getBankCodePrefix,
} from "@/shared/utils/bank-code";
import { resolvePagination } from "@/shared/utils/pagination";
import { prisma } from "@/server/db/client";
import {
  getBankById,
  listActiveBanks,
  listAdminBanks,
} from "@/server/repositories/bank-repository";

const MAX_CREATE_BANK_RETRIES = 5;

async function generateNextBankCode(
  tx: Prisma.TransactionClient,
  date = new Date(),
) {
  const period = getBankCodePeriod(date);
  const prefix = getBankCodePrefix(period);
  const latestBank = await tx.questionBank.findFirst({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    orderBy: {
      code: "desc",
    },
    select: {
      code: true,
    },
  });

  const latestSequence = latestBank
    ? extractBankCodeSequence(latestBank.code, period)
    : 0;

  if (latestBank && latestSequence === null) {
    throw new Error(
      `题库编码 ${latestBank.code} 不符合系统规则，无法生成新的编码。`,
    );
  }

  return buildBankCode(period, (latestSequence ?? 0) + 1);
}

function shouldRetryCreateBank(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

export async function listMobileBankSummaries(
  userId: string,
): Promise<BankSummary[]> {
  const banks = await listActiveBanks();
  const bankIds = banks.map((item) => item.id);

  const [stats, sessions] = await Promise.all([
    prisma.userQuestionStat.findMany({
      where: {
        userId,
        bankId: {
          in: bankIds,
        },
      },
      select: {
        bankId: true,
        totalAttempts: true,
        correctAttempts: true,
        isInWrongBook: true,
      },
    }),
    prisma.practiceSession.findMany({
      where: {
        userId,
        bankId: {
          in: bankIds,
        },
        status: "IN_PROGRESS",
        sourceType: PracticeSourceType.NORMAL,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        bankId: true,
      },
    }),
  ]);

  const statMap = new Map<
    string,
    {
      answeredQuestions: number;
      totalAttempts: number;
      correctAttempts: number;
      wrongBookCount: number;
    }
  >();

  for (const item of stats) {
    const current = statMap.get(item.bankId) ?? {
      answeredQuestions: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      wrongBookCount: 0,
    };

    current.answeredQuestions += 1;
    current.totalAttempts += item.totalAttempts;
    current.correctAttempts += item.correctAttempts;
    current.wrongBookCount += item.isInWrongBook ? 1 : 0;

    statMap.set(item.bankId, current);
  }

  const resumeMap = new Map<string, string>();
  for (const session of sessions) {
    if (!resumeMap.has(session.bankId)) {
      resumeMap.set(session.bankId, session.id);
    }
  }

  return banks.map((bank) => {
    const stat = statMap.get(bank.id);
    const totalQuestions = bank._count.questions;
    const answeredQuestions = stat?.answeredQuestions ?? 0;
    const totalAttempts = stat?.totalAttempts ?? 0;
    const correctAttempts = stat?.correctAttempts ?? 0;
    const accuracyRate =
      totalAttempts === 0 ? 0 : correctAttempts / totalAttempts;

    return {
      id: bank.id,
      code: bank.code,
      name: bank.name,
      description: bank.description,
      totalQuestions,
      answeredQuestions,
      accuracyRate,
      wrongBookCount: stat?.wrongBookCount ?? 0,
      progressRate:
        totalQuestions === 0 ? 0 : answeredQuestions / totalQuestions,
      resumeSessionId: resumeMap.get(bank.id) ?? null,
    };
  });
}

export async function getBankSetup(bankId: string) {
  const bank = await getBankById(bankId);
  if (!bank || bank.status !== BankStatus.ACTIVE) {
    return null;
  }

  return bank;
}

export async function assertBankExists(bankId: string) {
  const bank = await prisma.questionBank.findUnique({
    where: { id: bankId },
    select: { id: true },
  });

  if (!bank) {
    throw new Error("题库不存在");
  }

  return bank;
}

export async function listWrongBookSummaries(
  userId: string,
): Promise<WrongBookSummary[]> {
  const [stats, sessions] = await Promise.all([
    prisma.userQuestionStat.findMany({
      where: {
        userId,
        isInWrongBook: true,
        bank: {
          status: BankStatus.ACTIVE,
        },
      },
      include: {
        bank: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        lastAnsweredAt: "desc",
      },
    }),
    prisma.practiceSession.findMany({
      where: {
        userId,
        sourceType: PracticeSourceType.WRONG_BOOK,
        status: "IN_PROGRESS",
        bank: {
          status: BankStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        bankId: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const sessionMap = new Map<string, string>();
  for (const session of sessions) {
    if (!sessionMap.has(session.bankId)) {
      sessionMap.set(session.bankId, session.id);
    }
  }

  const grouped = new Map<string, WrongBookSummary>();

  for (const item of stats) {
    const existing = grouped.get(item.bankId);
    if (existing) {
      existing.wrongCount += 1;
      if (
        !existing.lastAnsweredAt ||
        (item.lastAnsweredAt &&
          item.lastAnsweredAt.toISOString() > existing.lastAnsweredAt)
      ) {
        existing.lastAnsweredAt =
          item.lastAnsweredAt?.toISOString() ?? existing.lastAnsweredAt;
      }
      continue;
    }

    grouped.set(item.bankId, {
      bankId: item.bankId,
      bankName: item.bank.name,
      wrongCount: 1,
      lastAnsweredAt: item.lastAnsweredAt?.toISOString() ?? null,
      latestPracticeStatus: sessionMap.has(item.bankId)
        ? "可继续练习"
        : "可开始练习",
      resumeSessionId: sessionMap.get(item.bankId) ?? null,
    });
  }

  return [...grouped.values()];
}

export async function listBanksForAdmin(rawQuery: unknown) {
  const query = bankListQuerySchema.parse(rawQuery);

  const where: Prisma.QuestionBankWhereInput = {
    ...(query.keyword
      ? {
          OR: [
            { name: { contains: query.keyword, mode: "insensitive" } },
            { code: { contains: query.keyword, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, bankTotal, activeBankTotal, activeQuestionTotal] =
    await prisma.$transaction([
      prisma.questionBank.count({ where }),
      prisma.questionBank.count(),
      prisma.questionBank.count({
        where: {
          status: BankStatus.ACTIVE,
        },
      }),
      prisma.question.count({
        where: {
          bank: {
            status: BankStatus.ACTIVE,
          },
        },
      }),
    ]);

  const { skip, take, page, pageSize } = resolvePagination(
    query.page,
    query.pageSize,
    total,
  );
  const items = await listAdminBanks(where, skip, take);

  return {
    items,
    total,
    page,
    pageSize,
    summary: {
      bankTotal,
      activeBankTotal,
      activeQuestionTotal,
    },
  };
}

export async function createBank(input: CreateBankInput) {
  const payload = createBankSchema.parse(input);

  for (let attempt = 1; attempt <= MAX_CREATE_BANK_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const code = await generateNextBankCode(tx);

          return tx.questionBank.create({
            data: {
              code,
              name: payload.name,
              description: payload.description?.trim() || null,
              sortOrder: payload.sortOrder,
              status: BankStatus.ACTIVE,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        attempt === MAX_CREATE_BANK_RETRIES ||
        !shouldRetryCreateBank(error)
      ) {
        throw error;
      }
    }
  }

  throw new Error("题库编码生成失败，请稍后重试");
}

export async function updateBank(bankId: string, input: UpdateBankInput) {
  const payload = updateBankSchema.parse(input);

  return prisma.questionBank.update({
    where: { id: bankId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description || null }
        : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.sortOrder !== undefined
        ? { sortOrder: payload.sortOrder }
        : {}),
    },
  });
}

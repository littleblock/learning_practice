import { JobType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";

export async function listRecentQuestionImportJobs(bankId: string) {
  const jobs = await prisma.job.findMany({
    where: {
      type: JobType.IMPORT_QUESTIONS,
      payload: {
        path: ["bankId"],
        equals: bankId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
    select: {
      id: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      createdAt: true,
      finishedAt: true,
      payload: true,
    },
  });

  return jobs.map((job) => {
    const payload = (job.payload as Prisma.JsonObject | null) ?? {};
    return {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
      fileName: typeof payload.fileName === "string" ? payload.fileName : "未命名文件",
    };
  });
}

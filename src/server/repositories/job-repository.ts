import { Job, JobStatus, JobType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { resolveRetryStatus } from "@/server/queue/retry";

export async function enqueueJob<TPayload extends Prisma.JsonObject>(
  type: JobType,
  payload: TPayload,
  maxAttempts = 3,
) {
  return prisma.job.create({
    data: {
      type,
      payload,
      maxAttempts,
    },
  });
}

export async function claimNextPendingJob(workerId: string) {
  const rows = await prisma.$queryRaw<Job[]>`
    WITH picked AS (
      SELECT "id"
      FROM "Job"
      WHERE "status" = 'PENDING'
        AND "availableAt" <= NOW()
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "Job" AS job
    SET
      "status" = 'PROCESSING',
      "lockedAt" = NOW(),
      "lockedBy" = ${workerId},
      "attempts" = job."attempts" + 1,
      "updatedAt" = NOW()
    FROM picked
    WHERE job."id" = picked."id"
    RETURNING job.*;
  `;

  return rows[0] ?? null;
}

export async function markJobCompleted(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

export async function releaseJobFailure(job: Pick<Job, "id" | "attempts" | "maxAttempts">, error: string) {
  const nextStatus = resolveRetryStatus(job.attempts, job.maxAttempts);
  const reachedMaxAttempts = nextStatus === JobStatus.FAILED;

  return prisma.job.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      availableAt: reachedMaxAttempts ? undefined : new Date(Date.now() + 60_000),
      finishedAt: reachedMaxAttempts ? new Date() : null,
      lockedAt: null,
      lockedBy: null,
      lastError: error.slice(0, 4000),
    },
  });
}

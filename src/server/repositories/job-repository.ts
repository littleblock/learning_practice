import { Job, JobStatus, JobType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { logger } from "@/server/logger";
import { resolveRetryStatus } from "@/server/queue/retry";

const staleJobLockTimeoutMs = 15 * 60_000;
export const jobLockHeartbeatIntervalMs = 30_000;

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

export async function recoverStaleProcessingJobs() {
  return prisma.job.updateMany({
    where: {
      status: JobStatus.PROCESSING,
      lockedAt: {
        lt: new Date(Date.now() - staleJobLockTimeoutMs),
      },
    },
    data: {
      status: JobStatus.PENDING,
      availableAt: new Date(),
      finishedAt: null,
      lockedAt: null,
      lockedBy: null,
      lastError: "任务执行超时，已自动重新排队",
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

export async function touchJobLock(jobId: string, workerId: string) {
  return prisma.job.updateMany({
    where: {
      id: jobId,
      status: JobStatus.PROCESSING,
      lockedBy: workerId,
    },
    data: {
      lockedAt: new Date(),
    },
  });
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

export async function markJobCancelled(jobId: string, error?: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.CANCELLED,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: error?.slice(0, 4000) ?? "任务已取消",
    },
  });
}

export async function releaseJobFailure(
  job: Pick<Job, "id" | "attempts" | "maxAttempts">,
  error: string,
) {
  const nextStatus = resolveRetryStatus(job.attempts, job.maxAttempts);
  const reachedMaxAttempts = nextStatus === JobStatus.FAILED;

  if (error.length > 4000) {
    logger.error(
      { jobId: job.id, fullError: error },
      "Job error truncated for storage",
    );
  }

  return prisma.job.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      availableAt: reachedMaxAttempts
        ? undefined
        : new Date(Date.now() + 60_000),
      finishedAt: reachedMaxAttempts ? new Date() : null,
      lockedAt: null,
      lockedBy: null,
      lastError: error.slice(0, 4000),
    },
  });
}

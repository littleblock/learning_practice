import { JobType } from "@prisma/client";

import { logger } from "@/server/logger";
import { captureServerException } from "@/server/monitoring/sentry";
import {
  claimNextPendingJob,
  jobLockHeartbeatIntervalMs,
  markJobCompleted,
  recoverStaleProcessingJobs,
  releaseJobFailure,
  touchJobLock,
} from "@/server/repositories/job-repository";
import {
  parseJobPayload,
  type ImportQuestionsJobPayload,
  type ProcessStatuteDocumentJobPayload,
  type RebuildQuestionMatchJobPayload,
} from "@/server/queue/job-types";
import { processQuestionImportBatch } from "@/server/services/question-import-service";
import {
  rebuildMatchesForBank,
  processStatuteDocument,
} from "@/server/services/statute-service";
import { markQuestionImportBatchFailed } from "@/server/services/question-import-service";

async function processJob(workerId: string) {
  const recoveredJobs = await recoverStaleProcessingJobs();
  if (recoveredJobs.count > 0) {
    logger.warn(
      { count: recoveredJobs.count },
      "Recovered stale processing jobs",
    );
  }

  const job = await claimNextPendingJob(workerId);

  if (!job) {
    return false;
  }

  const heartbeat = setInterval(() => {
    void touchJobLock(job.id, workerId);
  }, jobLockHeartbeatIntervalMs);

  try {
    switch (job.type) {
      case JobType.IMPORT_QUESTIONS: {
        const payload = parseJobPayload(
          job.type,
          job.payload,
        ) as ImportQuestionsJobPayload;
        await processQuestionImportBatch(payload.batchId);
        break;
      }
      case JobType.PROCESS_STATUTE_DOCUMENT: {
        const payload = parseJobPayload(
          job.type,
          job.payload,
        ) as ProcessStatuteDocumentJobPayload;
        await processStatuteDocument(payload.documentId);
        break;
      }
      case JobType.REBUILD_QUESTION_MATCH: {
        const payload = parseJobPayload(
          job.type,
          job.payload,
        ) as RebuildQuestionMatchJobPayload;
        await rebuildMatchesForBank(payload.bankId, payload.questionIds);
        break;
      }
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    await markJobCompleted(job.id);
    logger.info({ jobId: job.id, jobType: job.type }, "Job completed");
  } catch (error) {
    logger.error({ error, jobId: job.id, jobType: job.type }, "Job failed");
    captureServerException(error, {
      jobId: job.id,
      jobType: job.type,
      workerId,
    });

    if (job.type === JobType.IMPORT_QUESTIONS) {
      try {
        const payload = parseJobPayload(
          job.type,
          job.payload,
        ) as ImportQuestionsJobPayload;
        await markQuestionImportBatchFailed(
          payload.batchId,
          error instanceof Error ? error.message : "导题解析失败",
        );
      } catch (markError) {
        logger.error(
          { error: markError, jobId: job.id },
          "Failed to update import batch status after job failure",
        );
      }
    }

    await releaseJobFailure(
      job,
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    clearInterval(heartbeat);
  }

  return true;
}

export async function startWorkerLoop(workerId: string, intervalMs = 5000) {
  logger.info({ workerId }, "Worker started");

  while (true) {
    const processed = await processJob(workerId);

    if (!processed) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

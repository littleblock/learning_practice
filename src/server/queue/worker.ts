import { JobType } from "@prisma/client";

import { logger } from "@/server/logger";
import { captureServerException } from "@/server/monitoring/sentry";
import { claimNextPendingJob, markJobCompleted, releaseJobFailure } from "@/server/repositories/job-repository";
import {
  parseJobPayload,
  type ImportQuestionsJobPayload,
  type ProcessStatuteDocumentJobPayload,
  type RebuildQuestionMatchJobPayload,
} from "@/server/queue/job-types";
import { importQuestionsFromWorkbook } from "@/server/services/question-service";
import { rebuildMatchesForBank, processStatuteDocument } from "@/server/services/statute-service";
import { readStoredFile } from "@/server/storage/file-storage";

async function processJob(workerId: string) {
  const job = await claimNextPendingJob(workerId);

  if (!job) {
    return false;
  }

  try {
    switch (job.type) {
      case JobType.IMPORT_QUESTIONS: {
        const payload = parseJobPayload(job.type, job.payload) as ImportQuestionsJobPayload;
        const buffer = await readStoredFile(payload.storagePath);
        await importQuestionsFromWorkbook(payload.bankId, buffer);
        break;
      }
      case JobType.PROCESS_STATUTE_DOCUMENT: {
        const payload = parseJobPayload(job.type, job.payload) as ProcessStatuteDocumentJobPayload;
        await processStatuteDocument(payload.documentId);
        break;
      }
      case JobType.REBUILD_QUESTION_MATCH: {
        const payload = parseJobPayload(job.type, job.payload) as RebuildQuestionMatchJobPayload;
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
    captureServerException(error, { jobId: job.id, jobType: job.type, workerId });
    await releaseJobFailure(job, error instanceof Error ? error.message : "Unknown error");
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

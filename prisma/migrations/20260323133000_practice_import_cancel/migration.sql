ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';

ALTER TYPE "QuestionImportBatchStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "QuestionImportBatch"
ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PracticeAttempt_sessionItemId_key"
ON "PracticeAttempt"("sessionItemId");

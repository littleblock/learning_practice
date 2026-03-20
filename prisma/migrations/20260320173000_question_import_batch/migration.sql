-- CreateEnum
CREATE TYPE "QuestionImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "Question"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- CreateTable
CREATE TABLE "QuestionImportBatch" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sourceSheetName" TEXT,
    "status" "QuestionImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "draftCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parsedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionImportDraft" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswers" JSONB NOT NULL,
    "analysis" TEXT,
    "lawSource" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "sourceLabel" TEXT,
    "sourceContent" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_createdById_idx" ON "Question"("createdById");

-- CreateIndex
CREATE INDEX "Question_updatedById_idx" ON "Question"("updatedById");

-- CreateIndex
CREATE INDEX "QuestionImportBatch_bankId_status_createdAt_idx" ON "QuestionImportBatch"("bankId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionImportBatch_createdById_createdAt_idx" ON "QuestionImportBatch"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionImportDraft_batchId_isDeleted_sortOrder_idx" ON "QuestionImportDraft"("batchId", "isDeleted", "sortOrder");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionImportBatch" ADD CONSTRAINT "QuestionImportBatch_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionImportBatch" ADD CONSTRAINT "QuestionImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionImportDraft" ADD CONSTRAINT "QuestionImportDraft_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "QuestionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

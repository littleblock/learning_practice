-- CreateEnum
CREATE TYPE "QuestionImportTemplateType" AS ENUM ('STANDARD', 'AI');

-- CreateEnum
CREATE TYPE "QuestionImportSourceStatus" AS ENUM ('HEADER', 'MATCHED', 'FAILED');

-- AlterTable
ALTER TABLE "QuestionImportBatch"
ADD COLUMN "templateType" "QuestionImportTemplateType";

-- AlterTable
ALTER TABLE "QuestionImportDraft"
ADD COLUMN "sourceRowNumbers" JSONB;

-- CreateTable
CREATE TABLE "QuestionImportSourceRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "QuestionImportSourceStatus" NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT,
    "matchedSortOrders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionImportSourceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionImportSourceRow_batchId_rowNumber_key" ON "QuestionImportSourceRow"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "QuestionImportSourceRow_batchId_status_rowNumber_idx" ON "QuestionImportSourceRow"("batchId", "status", "rowNumber");

-- AddForeignKey
ALTER TABLE "QuestionImportSourceRow" ADD CONSTRAINT "QuestionImportSourceRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "QuestionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

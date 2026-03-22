ALTER TABLE "Question"
ADD COLUMN "importBatchId" TEXT;

ALTER TABLE "QuestionImportBatch"
ADD COLUMN "schemaMode" TEXT,
ADD COLUMN "schemaSummary" JSONB;

CREATE INDEX "Question_importBatchId_idx" ON "Question"("importBatchId");

ALTER TABLE "Question"
ADD CONSTRAINT "Question_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "QuestionImportBatch"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

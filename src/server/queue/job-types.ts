import { JobType } from "@prisma/client";
import { z } from "zod";

const importQuestionsJobSchema = z.object({
  bankId: z.string().cuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
});

const processStatuteDocumentJobSchema = z.object({
  documentId: z.string().cuid(),
});

const rebuildQuestionMatchJobSchema = z.object({
  bankId: z.string().cuid(),
  questionIds: z.array(z.string().cuid()).optional(),
});

export type ImportQuestionsJobPayload = z.infer<typeof importQuestionsJobSchema>;
export type ProcessStatuteDocumentJobPayload = z.infer<typeof processStatuteDocumentJobSchema>;
export type RebuildQuestionMatchJobPayload = z.infer<typeof rebuildQuestionMatchJobSchema>;

export function parseJobPayload(type: JobType, payload: unknown) {
  switch (type) {
    case JobType.IMPORT_QUESTIONS:
      return importQuestionsJobSchema.parse(payload);
    case JobType.PROCESS_STATUTE_DOCUMENT:
      return processStatuteDocumentJobSchema.parse(payload);
    case JobType.REBUILD_QUESTION_MATCH:
      return rebuildQuestionMatchJobSchema.parse(payload);
    default:
      throw new Error(`不支持的任务类型: ${type satisfies never}`);
  }
}

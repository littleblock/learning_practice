import { PracticeMode, PracticeSourceType } from "@prisma/client";
import { z } from "zod";

export const createPracticeSessionSchema = z.object({
  practiceMode: z.nativeEnum(PracticeMode),
  sourceType: z.nativeEnum(PracticeSourceType).default(PracticeSourceType.NORMAL),
});

export const submitPracticeAnswerSchema = z.object({
  selectedAnswers: z.array(z.string().trim().min(1)).min(1, "请至少选择一个答案"),
});

export type CreatePracticeSessionInput = z.infer<typeof createPracticeSessionSchema>;
export type SubmitPracticeAnswerInput = z.infer<typeof submitPracticeAnswerSchema>;

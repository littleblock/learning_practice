import { QuestionType } from "@prisma/client";
import { z } from "zod";

export const questionOptionSchema = z.object({
  label: z.string().trim().min(1, "选项标识不能为空"),
  text: z.string().trim().min(1, "选项内容不能为空"),
});

export const upsertQuestionSchema = z
  .object({
    type: z.nativeEnum(QuestionType),
    stem: z.string().trim().min(5, "题干至少 5 个字符"),
    options: z.array(questionOptionSchema).min(2, "至少保留两个选项"),
    correctAnswers: z
      .array(z.string().trim().min(1))
      .min(1, "请至少填写一个正确答案"),
    analysis: z.string().trim().max(5000, "解析过长").nullable().default(null),
    lawSource: z
      .string()
      .trim()
      .max(255, "答案来源过长")
      .nullable()
      .default(null),
    sortOrder: z.coerce.number().int().min(1).max(999999),
  })
  .superRefine((value, context) => {
    const labels = new Set(
      value.options.map((item) => item.label.toUpperCase()),
    );

    for (const answer of value.correctAnswers) {
      if (!labels.has(answer.toUpperCase())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `正确答案 ${answer} 不在选项范围内`,
          path: ["correctAnswers"],
        });
      }
    }

    if (
      value.type !== QuestionType.MULTIPLE &&
      value.correctAnswers.length !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "单选题和判断题只能配置一个正确答案",
        path: ["correctAnswers"],
      });
    }
  });

export const questionListQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  type: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.nativeEnum(QuestionType).optional(),
  ),
  lawSource: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const questionImportRowSchema = z
  .object({
    bank_code: z.string().trim().optional(),
    question_type: z.enum(["single", "multiple", "judge"]),
    stem: z.string().trim().min(5, "题干不能为空"),
    option_a: z.string().trim().optional(),
    option_b: z.string().trim().optional(),
    option_c: z.string().trim().optional(),
    option_d: z.string().trim().optional(),
    option_e: z.string().trim().optional(),
    option_f: z.string().trim().optional(),
    correct_answer: z.string().trim().min(1, "正确答案不能为空"),
    analysis: z.string().trim().optional(),
    law_source: z.string().trim().optional(),
    sort_order: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((value, context) => {
    const filledOptions = [
      value.option_a,
      value.option_b,
      value.option_c,
      value.option_d,
      value.option_e,
      value.option_f,
    ].filter((option) => option && option.length > 0);

    const isJudgeWithoutOptions =
      value.question_type === "judge" && filledOptions.length === 0;

    if (!isJudgeWithoutOptions && filledOptions.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "至少需要填写两个选项",
        path: ["option_a"],
      });
    }
  });

export const questionImportDraftSchema = z.object({
  type: z.nativeEnum(QuestionType),
  stem: z.string().trim().min(5, "题干至少 5 个字符"),
  options: z.array(questionOptionSchema).min(2, "至少保留两个选项"),
  correctAnswers: z
    .array(z.string().trim().min(1))
    .min(1, "请至少填写一个正确答案"),
  analysis: z.string().trim().max(5000, "解析过长").nullable().default(null),
  lawSource: z
    .string()
    .trim()
    .max(255, "答案来源过长")
    .nullable()
    .default(null),
  sortOrder: z.coerce.number().int().min(1).max(999999),
  sourceLabel: z
    .string()
    .trim()
    .max(255, "来源标识过长")
    .nullable()
    .default(null),
  sourceContent: z
    .string()
    .trim()
    .max(20000, "来源内容过长")
    .nullable()
    .default(null),
  sourceRowNumbers: z
    .array(z.coerce.number().int().min(1))
    .min(1, "至少保留一个来源行号")
    .max(50, "来源行数过多"),
});

export const deleteImportDraftsSchema = z.object({
  draftIds: z.array(z.string().cuid()).min(1, "请至少选择一条待删除草稿"),
});

export type UpsertQuestionInput = z.infer<typeof upsertQuestionSchema>;
export type QuestionImportRow = z.infer<typeof questionImportRowSchema>;
export type QuestionImportDraftInput = z.infer<
  typeof questionImportDraftSchema
>;
export type DeleteImportDraftsInput = z.infer<typeof deleteImportDraftsSchema>;

import { describe, expect, it } from "vitest";

import { questionImportRowSchema } from "@/shared/schemas/question";

describe("question import row schema", () => {
  it("允许判断题省略选项并使用默认选项兜底", () => {
    expect(
      questionImportRowSchema.parse({
        question_type: "judge",
        stem: "这是一道用于验证判断题导入的测试题目",
        correct_answer: "正确",
        analysis: "",
        law_source: "",
        sort_order: 1,
      }),
    ).toMatchObject({
      question_type: "judge",
      correct_answer: "正确",
      sort_order: 1,
    });
  });

  it("非判断题仍然要求至少两个选项", () => {
    expect(() =>
      questionImportRowSchema.parse({
        question_type: "single",
        stem: "这是一道用于验证单选题选项校验的测试题目",
        option_a: "选项A",
        correct_answer: "A",
        analysis: "",
        law_source: "",
        sort_order: 1,
      }),
    ).toThrow("至少需要填写两个选项");
  });
});

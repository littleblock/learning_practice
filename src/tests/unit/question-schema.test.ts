import { describe, expect, it } from "vitest";
import { QuestionType } from "@prisma/client";

import { upsertQuestionSchema } from "@/shared/schemas/question";

describe("upsertQuestionSchema", () => {
  it("拒绝缺失正确答案的选项配置", () => {
    expect(() =>
      upsertQuestionSchema.parse({
        type: QuestionType.SINGLE,
        stem: "测试题干内容",
        options: [
          { label: "A", text: "选项A" },
          { label: "B", text: "选项B" },
        ],
        correctAnswers: ["C"],
        sortOrder: 1,
      }),
    ).toThrowError();
  });

  it("允许标准单选题配置", () => {
    expect(
      upsertQuestionSchema.parse({
        type: QuestionType.SINGLE,
        stem: "测试题干内容",
        options: [
          { label: "A", text: "选项A" },
          { label: "B", text: "选项B" },
        ],
        correctAnswers: ["A"],
        sortOrder: 1,
      }),
    ).toBeTruthy();
  });
});

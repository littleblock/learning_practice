import { describe, expect, it } from "vitest";
import { QuestionType } from "@prisma/client";

import { isAnswerCorrect, normalizeAnswerValues } from "@/shared/utils/answers";

describe("answers", () => {
  it("单选题按归一化结果判断正误", () => {
    expect(isAnswerCorrect(QuestionType.SINGLE, [" a "], ["A"])).toBe(true);
    expect(isAnswerCorrect(QuestionType.SINGLE, ["B"], ["A"])).toBe(false);
  });

  it("多选题需要完全匹配", () => {
    expect(isAnswerCorrect(QuestionType.MULTIPLE, ["B", "A"], ["A", "B"])).toBe(true);
    expect(isAnswerCorrect(QuestionType.MULTIPLE, ["A"], ["A", "B"])).toBe(false);
  });

  it("归一化答案会去重并排序", () => {
    expect(normalizeAnswerValues(["b", "A", "a"])).toEqual(["A", "B"]);
  });
});

import { QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { questionImportDraftSchema } from "@/shared/schemas/question";
import {
  looksLikeLawSource,
  mapImportRowToQuestionInput,
  normalizeImportQuestionTypeValue,
  normalizeQuestionInput,
} from "@/server/services/question-payload";

describe("question import payload helpers", () => {
  it("将标准 Excel 行映射为题目输入", () => {
    expect(
      mapImportRowToQuestionInput({
        bank_code: "TK-202603-00000001",
        question_type: "multiple",
        stem: "测试题干内容",
        option_a: "选项A",
        option_b: "选项B",
        option_c: "选项C",
        option_d: "",
        option_e: "",
        option_f: "",
        correct_answer: "a，c",
        analysis: "解析内容",
        law_source: "民法典",
        sort_order: 12,
      }),
    ).toMatchObject({
      type: QuestionType.MULTIPLE,
      correctAnswers: ["A", "C"],
      sortOrder: 12,
    });
  });

  it("支持数字答案和判断题默认选项", () => {
    expect(
      mapImportRowToQuestionInput({
        bank_code: "",
        question_type: "single",
        stem: "这是一道用于验证数字答案的测试题目",
        option_a: "选项1",
        option_b: "选项2",
        option_c: "选项3",
        option_d: "选项4",
        option_e: "",
        option_f: "",
        correct_answer: "4",
        analysis: "",
        law_source: "",
        sort_order: undefined,
      }).correctAnswers,
    ).toEqual(["D"]);

    expect(
      mapImportRowToQuestionInput({
        bank_code: "",
        question_type: "judge",
        stem: "这是一道用于验证判断题默认选项的测试题目",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        option_f: "",
        correct_answer: "正确",
        analysis: "",
        law_source: "",
        sort_order: undefined,
      }),
    ).toMatchObject({
      type: QuestionType.JUDGE,
      options: [
        { label: "A", text: "正确" },
        { label: "B", text: "错误" },
      ],
      correctAnswers: ["A"],
    });
  });

  it("识别中文题型和值得作为答案来源的文本", () => {
    expect(normalizeImportQuestionTypeValue("单选题")).toBe("single");
    expect(normalizeImportQuestionTypeValue("多选")).toBe("multiple");
    expect(normalizeImportQuestionTypeValue("判断题")).toBe("judge");
    expect(looksLikeLawSource("《安全生产法》第十七条")).toBe(true);
    expect(looksLikeLawSource("先检测、再通风、后作业")).toBe(false);
  });

  it("标准化导题草稿内容", () => {
    expect(
      normalizeQuestionInput(
        questionImportDraftSchema.parse({
          type: QuestionType.SINGLE,
          stem: " 这是一道测试题干 ",
          options: [
            { label: "a", text: " 选项A " },
            { label: "b", text: " 选项B " },
          ],
          correctAnswers: [" a "],
          analysis: " 解析 ",
          lawSource: " 来源 ",
          sortOrder: 3,
          sourceLabel: "第 2 行",
          sourceContent: "第 2 行 | 测试内容",
          sourceRowNumbers: [2],
        }),
      ),
    ).toEqual({
      type: QuestionType.SINGLE,
      stem: "这是一道测试题干",
      options: [
        { label: "A", text: "选项A" },
        { label: "B", text: "选项B" },
      ],
      correctAnswers: ["A"],
      analysis: "解析",
      lawSource: "来源",
      sortOrder: 3,
    });
  });
});

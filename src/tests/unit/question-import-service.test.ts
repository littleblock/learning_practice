import { QuestionImportSourceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  isStandardTemplate,
  parseStandardTemplateDrafts,
  type SheetRow,
} from "@/server/services/question-import-service";

describe("question import service standard template parser", () => {
  it("仅识别标准模板表头，并为每一行生成处理状态", () => {
    const rows: SheetRow[] = [
      {
        rowNumber: 1,
        values: [
          "题型",
          "题干",
          "选项A",
          "选项B",
          "选项C",
          "选项D",
          "选项E",
          "选项F",
          "正确答案",
          "解析",
          "答案来源",
          "序号",
        ],
        content: "题型 | 题干 | 选项A | 选项B | 正确答案",
      },
      {
        rowNumber: 2,
        values: [
          "单选题",
          "根据法律规定，下列说法正确的是？",
          "选项A",
          "选项B",
          "选项C",
          "选项D",
          "",
          "",
          "4",
          "依据法条规定作答",
          "《安全生产法》第十七条",
          "1",
        ],
        content: "单选题 | 根据法律规定，下列说法正确的是？ | 选项A | 选项B | 选项C | 选项D | 4",
      },
      {
        rowNumber: 3,
        values: [
          "多选题",
          "这一行缺少足够选项",
          "选项A",
          "",
          "",
          "",
          "",
          "",
          "A",
          "",
          "",
          "2",
        ],
        content: "多选题 | 这一行缺少足够选项 | 选项A | A",
      },
    ];

    expect(isStandardTemplate(rows)).toBe(true);

    const result = parseStandardTemplateDrafts(rows, 1);

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]).toMatchObject({
      stem: "根据法律规定，下列说法正确的是？",
      correctAnswers: ["D"],
      lawSource: "《安全生产法》第十七条",
      sourceRowNumbers: [2],
      sortOrder: 1,
    });
    expect(result.sourceRows).toEqual([
      expect.objectContaining({
        rowNumber: 1,
        status: QuestionImportSourceStatus.HEADER,
      }),
      expect.objectContaining({
        rowNumber: 2,
        status: QuestionImportSourceStatus.MATCHED,
        matchedSortOrders: [1],
      }),
      expect.objectContaining({
        rowNumber: 3,
        status: QuestionImportSourceStatus.FAILED,
      }),
    ]);
  });

  it("非标准表头不会被误判为规则模板", () => {
    const rows: SheetRow[] = [
      {
        rowNumber: 1,
        values: ["内容", "备注"],
        content: "内容 | 备注",
      },
      {
        rowNumber: 2,
        values: ["这是一段自由文本", "需要 AI 识别"],
        content: "这是一段自由文本 | 需要 AI 识别",
      },
    ];

    expect(isStandardTemplate(rows)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  detectStructuredQuestionImportSchema,
  parseRowsWithStructuredSchema,
  type ImportSchemaSheetRow,
} from "@/server/services/question-import-schema-service";

function buildRows(): ImportSchemaSheetRow[] {
  return [
    {
      rowNumber: 1,
      values: [
        "题型分类",
        "适用资格类别",
        "题目",
        "选项A",
        "选项B",
        "选项C",
        "选项D",
        "备注",
        "标准答案",
        "法条依据",
      ],
      content:
        "题型分类 | 适用资格类别 | 题目 | 选项A | 选项B | 选项C | 选项D | 备注 | 标准答案 | 法条依据",
    },
    {
      rowNumber: 28,
      values: [
        "单选题",
        "A",
        "故意不如实报告事故情况属于（ ）",
        "漏报",
        "迟报",
        "谎报",
        "瞒报",
        "",
        "3",
        "《生产安全事故罚款处罚规定》第五条",
      ],
      content:
        "单选题 | A | 故意不如实报告事故情况属于（ ） | 漏报 | 迟报 | 谎报 | 瞒报 |  | 3 | 《生产安全事故罚款处罚规定》第五条",
    },
    {
      rowNumber: 35,
      values: [
        "单选题",
        "A",
        "生产经营单位应当为从业人员提供符合国家标准的劳动防护用品，该说法（ ）",
        "错误",
        "片面",
        "需审批后执行",
        "正确",
        "",
        "4",
        "《北京市安全生产条例》第二十八条",
      ],
      content:
        "单选题 | A | 生产经营单位应当为从业人员提供符合国家标准的劳动防护用品，该说法（ ） | 错误 | 片面 | 需审批后执行 | 正确 |  | 4 | 《北京市安全生产条例》第二十八条",
    },
  ];
}

describe("question import structured schema service", () => {
  it("为同一批 Excel 锁定统一列语义并忽略资格类别列", async () => {
    const rows = buildRows();

    const result = await detectStructuredQuestionImportSchema(rows);

    expect(result.mode).toBe("HEURISTIC");
    expect(result.summary.headerRowCount).toBe(1);
    expect(result.summary.stemColumn).toBe(2);
    expect(result.summary.answerColumn).toBe(8);
    expect(result.summary.optionColumns).toEqual([3, 4, 5, 6]);
    expect(result.summary.ignoredColumns).toContain(1);
    expect(result.summary.answerEncoding).toBe("NUMERIC_INDEX");
  });

  it("按统一 schema 解析时会把数字答案稳定归一化为字母答案", () => {
    const rows = buildRows();

    const parsed = parseRowsWithStructuredSchema(rows, {
      headerRowCount: 1,
      questionTypeColumn: 0,
      stemColumn: 2,
      optionColumns: [3, 4, 5, 6],
      answerColumn: 8,
      analysisColumn: null,
      lawSourceColumn: 9,
      ignoredColumns: [1, 7],
      answerEncoding: "NUMERIC_INDEX",
    }, 1);

    expect(parsed.failedRows).toEqual([]);
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.drafts[0]).toMatchObject({
      sortOrder: 1,
      sourceRowNumbers: [28],
      correctAnswers: ["C"],
    });
    expect(parsed.drafts[1]).toMatchObject({
      sortOrder: 2,
      sourceRowNumbers: [35],
      correctAnswers: ["D"],
    });
  });
});

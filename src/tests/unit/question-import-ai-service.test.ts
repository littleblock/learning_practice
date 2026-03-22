import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.resetModules();
});

function applyTestEnv() {
  process.env.AI_SPLIT_BASE_URL = "https://example.com/v1";
  process.env.AI_SPLIT_API_KEY = "test-key";
  process.env.AI_SPLIT_MODEL = "test-model";
  process.env.AI_SPLIT_TIMEOUT_MS = "1000";
  process.env.AI_SPLIT_MAX_RETRIES = "1";
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
  process.env.SESSION_SECRET = "test-session-secret";
}

describe("question import ai service", () => {
  it("AI 列语义识别会把缺失列规范化为 null 并保留忽略列", async () => {
    applyTestEnv();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headerRowCount: 1,
                  questionTypeColumn: 0,
                  stemColumn: 2,
                  optionColumns: [3, 4, 5, 6],
                  answerColumn: 8,
                  ignoredColumns: [1],
                  answerEncoding: "NUMERIC_INDEX",
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    ) as typeof global.fetch;

    const { detectQuestionImportSchemaWithAi } = await import(
      "@/server/services/question-import-ai-service"
    );

    await expect(
      detectQuestionImportSchemaWithAi([
        {
          rowNumber: 1,
          values: [
            "题型分类",
            "适用资格类别",
            "题目",
            "选项A",
            "选项B",
            "标准答案",
          ],
        },
      ]),
    ).resolves.toEqual({
      headerRowCount: 1,
      questionTypeColumn: 0,
      stemColumn: 2,
      optionColumns: [3, 4, 5, 6],
      answerColumn: 8,
      analysisColumn: null,
      lawSourceColumn: null,
      ignoredColumns: [1],
      answerEncoding: "NUMERIC_INDEX",
    });
  });

  it("只会向模型发送压缩后的 schema 预览而不是整份文件内容", async () => {
    applyTestEnv();
    const lateRowMarker = "第十二行超长题干，不应该被完整发送给模型";

    global.fetch = vi.fn().mockImplementation(async (_input, init) => {
      const requestBody = JSON.parse(String(init?.body ?? "{}"));
      const userMessage = String(requestBody.messages?.[1]?.content ?? "");

      expect(userMessage).toContain('"previewRows"');
      expect(userMessage).toContain('"columns"');
      expect(userMessage).not.toContain(lateRowMarker);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headerRowCount: 1,
                  questionTypeColumn: 0,
                  stemColumn: 2,
                  optionColumns: [3, 4, 5, 6],
                  answerColumn: 8,
                  analysisColumn: null,
                  lawSourceColumn: 9,
                  ignoredColumns: [1],
                  answerEncoding: "NUMERIC_INDEX",
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }) as typeof global.fetch;

    const rows = Array.from({ length: 12 }, (_, index) => {
      const rowNumber = index + 1;
      const stem =
        rowNumber === 12
          ? lateRowMarker
          : `第 ${rowNumber} 行题干内容，用于测试 schema 预览压缩`;

      return {
        rowNumber,
        values: [
          rowNumber === 1 ? "题型分类" : "单选题",
          rowNumber === 1 ? "适用资格类别" : "A",
          rowNumber === 1 ? "题目" : stem,
          rowNumber === 1 ? "选项A" : "选项一",
          rowNumber === 1 ? "选项B" : "选项二",
          rowNumber === 1 ? "选项C" : "选项三",
          rowNumber === 1 ? "选项D" : "选项四",
          rowNumber === 1 ? "标准答案" : "3",
          rowNumber === 1 ? "法条依据" : "《条例》第五条",
        ],
      };
    });

    const { detectQuestionImportSchemaWithAi } = await import(
      "@/server/services/question-import-ai-service"
    );

    await expect(detectQuestionImportSchemaWithAi(rows)).resolves.toMatchObject({
      headerRowCount: 1,
      answerColumn: 8,
      ignoredColumns: [1],
    });
  });
});

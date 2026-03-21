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
  it("接受模型返回的空字段并补齐来源行信息", async () => {
    applyTestEnv();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    type: "single",
                    stem: "这是一道用于校验 AI 导题的测试题目",
                    options: [
                      { label: "A", text: "选项A" },
                      { label: "B", text: "选项B" },
                    ],
                    correctAnswers: ["A"],
                    analysis: null,
                    lawSource: null,
                    sourceLabel: null,
                    sourceContent: null,
                    sourceRowNumbers: [1],
                  },
                ]),
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

    const { splitQuestionsWithAi } = await import(
      "@/server/services/question-import-ai-service"
    );

    await expect(
      splitQuestionsWithAi([{ rowNumber: 1, content: "测试内容" }], 1),
    ).resolves.toMatchObject([
      {
        stem: "这是一道用于校验 AI 导题的测试题目",
        analysis: null,
        lawSource: null,
        sourceLabel: "第 1 行",
        sourceContent: "第 1 行 | 测试内容",
        sourceRowNumbers: [1],
        sortOrder: 1,
      },
    ]);
  });

  it("兼容字符串数组选项并自动补齐选项标识", async () => {
    applyTestEnv();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    type: "single",
                    stem: "这是一道字符串选项格式的测试题目",
                    options: ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"],
                    correctAnswers: ["4"],
                    analysis: "解析内容",
                    lawSource: null,
                    sourceLabel: null,
                    sourceContent: null,
                    sourceRowNumbers: ["3"],
                  },
                ]),
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

    const { splitQuestionsWithAi } = await import(
      "@/server/services/question-import-ai-service"
    );

    await expect(
      splitQuestionsWithAi([{ rowNumber: 3, content: "测试内容二" }], 10),
    ).resolves.toMatchObject([
      {
        stem: "这是一道字符串选项格式的测试题目",
        options: [
          { label: "A", text: "选项一" },
          { label: "B", text: "选项二" },
          { label: "C", text: "选项三" },
          { label: "D", text: "选项四" },
        ],
        correctAnswers: ["D"],
        sourceRowNumbers: [3],
        sortOrder: 10,
      },
    ]);
  });

  it("兼容模型返回字符串排序号", async () => {
    applyTestEnv();

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    type: "single",
                    stem: "这是一道用于校验字符串排序号的测试题目",
                    options: [
                      { label: "A", text: "选项A" },
                      { label: "B", text: "选项B" },
                    ],
                    correctAnswers: ["1"],
                    analysis: null,
                    lawSource: null,
                    sortOrder: "12",
                    sourceLabel: null,
                    sourceContent: null,
                    sourceRowNumbers: [7],
                  },
                ]),
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

    const { splitQuestionsWithAi } = await import(
      "@/server/services/question-import-ai-service"
    );

    await expect(
      splitQuestionsWithAi([{ rowNumber: 7, content: "测试内容三" }], 1),
    ).resolves.toMatchObject([
      {
        stem: "这是一道用于校验字符串排序号的测试题目",
        sortOrder: 12,
        sourceRowNumbers: [7],
      },
    ]);
  });
});

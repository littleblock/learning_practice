import { QuestionType } from "@prisma/client";
import { z } from "zod";

import { questionOptionSchema } from "@/shared/schemas/question";
import type { PracticeAiExplanationView, QuestionOption } from "@/shared/types/domain";
import { getServerEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { getSessionWithCurrentQuestion } from "@/server/repositories/practice-repository";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
            type?: string;
          }>
        | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

const answerArraySchema = z.array(z.string());

function getQuestionTypeLabel(type: QuestionType) {
  switch (type) {
    case QuestionType.SINGLE:
      return "单选题";
    case QuestionType.MULTIPLE:
      return "多选题";
    case QuestionType.JUDGE:
      return "判断题";
    default:
      return "题目";
  }
}

function normalizeMessageContent(
  content:
    | string
    | Array<{
        text?: string;
        type?: string;
      }>
    | null
    | undefined,
) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function parseQuestionOptions(value: unknown) {
  return questionOptionSchema.array().parse(value);
}

function buildOptionText(options: QuestionOption[]) {
  return options.map((item) => `${item.label}. ${item.text}`).join("\n");
}

function buildFallbackExplanation(input: {
  type: QuestionType;
  selectedAnswers: string[];
  correctAnswers: string[];
  analysis: string | null;
  lawSource: string | null;
  matchedExcerpt: string | null;
}) {
  const learnerAnswer =
    input.selectedAnswers.length > 0
      ? input.selectedAnswers.join("、")
      : "未作答";
  const correctAnswer = input.correctAnswers.join("、");
  const segments = [
    `本题为${getQuestionTypeLabel(input.type)}，正确答案是 ${correctAnswer}。`,
    `你的作答是 ${learnerAnswer}。`,
    input.analysis ? `题目原解析：${input.analysis}` : null,
    input.lawSource ? `相关来源：${input.lawSource}` : null,
    input.matchedExcerpt ? `可参考法条片段：${input.matchedExcerpt}` : null,
  ].filter(Boolean);

  return segments.join("\n\n");
}

export async function generatePracticeQuestionAiExplanation(
  userId: string,
  sessionId: string,
): Promise<PracticeAiExplanationView> {
  const session = await getSessionWithCurrentQuestion(sessionId, userId);
  if (!session) {
    throw new Error("练习会话不存在");
  }

  const currentItem = session.currentItem;
  if (!currentItem) {
    throw new Error("当前没有可解析的题目");
  }

  const latestAttempt = currentItem.attempts[0] ?? null;
  if (!latestAttempt) {
    throw new Error("请先提交当前题目后再查看 AI 解析");
  }

  const options = parseQuestionOptions(currentItem.question.options);
  const selectedAnswers = answerArraySchema.parse(latestAttempt.selectedAnswers);
  const correctAnswers = answerArraySchema.parse(
    currentItem.question.correctAnswers,
  );
  const matchedExcerpt =
    currentItem.question.statuteMatch?.excerpt?.trim() || null;

  const fallbackContent = buildFallbackExplanation({
    type: currentItem.question.type,
    selectedAnswers,
    correctAnswers,
    analysis: currentItem.question.analysis,
    lawSource: currentItem.question.lawSource,
    matchedExcerpt,
  });

  const env = getServerEnv();
  if (!env.AI_SPLIT_API_KEY) {
    return {
      questionId: currentItem.question.id,
      content: fallbackContent,
      usedFallback: true,
    };
  }

  const requestTimeoutMs = Math.max(env.AI_SPLIT_TIMEOUT_MS, 90000);
  const requestStartedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const requestBody = {
    model: env.AI_SPLIT_MODEL,
    temperature: 0.2,
    max_tokens: 420,
    messages: [
      {
        role: "system",
        content: [
          "你是刷题讲解助手。",
          "请面向正在手机上做题的用户，用简洁中文输出解析。",
          "先说明正确答案，再说明判断依据，必要时补充法条来源。",
          "输出控制在 3 到 5 句，不要使用 Markdown 标题或代码块。",
        ].join(""),
      },
      {
        role: "user",
        content: [
          `题库：${session.bank.name}`,
          `题型：${getQuestionTypeLabel(currentItem.question.type)}`,
          `题干：${currentItem.question.stem}`,
          "选项：",
          buildOptionText(options),
          `用户答案：${selectedAnswers.join("、") || "未作答"}`,
          `正确答案：${correctAnswers.join("、")}`,
          currentItem.question.analysis
            ? `题目原解析：${currentItem.question.analysis}`
            : null,
          currentItem.question.lawSource
            ? `法条来源：${currentItem.question.lawSource}`
            : null,
          matchedExcerpt ? `法条片段：${matchedExcerpt}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  };

  try {
    const response = await fetch(
      `${env.AI_SPLIT_BASE_URL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_SPLIT_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      },
    );

    const rawText = await response.text();
    const payload = rawText
      ? (JSON.parse(rawText) as ChatCompletionResponse)
      : ({} as ChatCompletionResponse);

    if (!response.ok) {
      throw new Error(
        payload.error?.message ||
          `AI 解析调用失败：${response.status} ${response.statusText}`,
      );
    }

    const content = normalizeMessageContent(
      payload.choices?.[0]?.message?.content,
    );
    if (!content) {
      throw new Error("AI 解析未返回有效内容");
    }

    logger.info(
      {
        sessionId,
        questionId: currentItem.question.id,
        durationMs: Date.now() - requestStartedAt,
        timeoutMs: requestTimeoutMs,
        model: env.AI_SPLIT_MODEL,
      },
      "练习题 AI 解析生成完成",
    );

    return {
      questionId: currentItem.question.id,
      content,
      usedFallback: false,
    };
  } catch (error) {
    logger.warn(
      {
        sessionId,
        questionId: currentItem.question.id,
        durationMs: Date.now() - requestStartedAt,
        timeoutMs: requestTimeoutMs,
        model: env.AI_SPLIT_MODEL,
        error: error instanceof Error ? error.message : String(error),
      },
      "练习题 AI 解析生成失败，回退到题目原解析",
    );

    return {
      questionId: currentItem.question.id,
      content: fallbackContent,
      usedFallback: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

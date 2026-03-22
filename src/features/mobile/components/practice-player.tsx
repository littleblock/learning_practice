"use client";

import { QuestionType } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";

import { useMobileBusyNavigation } from "@/features/mobile/components/mobile-busy-provider";
import type {
  PracticeAiExplanationView,
  PracticeSessionView,
} from "@/shared/types/domain";
import { withAppBasePath } from "@/shared/utils/app-path";
import { getQuestionTypeLabel } from "@/shared/utils/answers";

interface PracticePlayerProps {
  initialView: PracticeSessionView;
}

function formatAnswerText(values: string[]) {
  return values.length > 0 ? values.join("、") : "未作答";
}

export function PracticePlayer({ initialView }: PracticePlayerProps) {
  const busyNavigation = useMobileBusyNavigation();
  const [view, setView] = useState(initialView);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(
    initialView.currentQuestion?.selectedAnswers ?? [],
  );
  const [isInteractive, setIsInteractive] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [explainingAi, setExplainingAi] = useState(false);
  const [aiExplanation, setAiExplanation] =
    useState<PracticeAiExplanationView | null>(null);
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [aiExplanationError, setAiExplanationError] = useState("");

  useEffect(() => {
    setSelectedAnswers(view.currentQuestion?.selectedAnswers ?? []);
    setFeedbackMessage("");
  }, [view]);

  useEffect(() => {
    setIsInteractive(true);
  }, []);

  useEffect(() => {
    setAiExplanation(null);
    setShowAiExplanation(false);
    setAiExplanationError("");
    setExplainingAi(false);
  }, [view.currentQuestion?.questionId]);

  const currentQuestion = view.currentQuestion;
  const multiple = currentQuestion?.type === QuestionType.MULTIPLE;
  const hasSubmitted = currentQuestion?.isCorrect !== null;
  const localBusyCopy = useMemo(() => {
    if (advancing) {
      return {
        title: "正在切换下一题",
        description: "题目内容很快就会刷新，请稍候。",
      };
    }

    if (submitting) {
      return {
        title: "正在提交答案",
        description: "系统正在判定当前题目的作答结果。",
      };
    }

    return null;
  }, [advancing, submitting]);

  async function submitAnswer() {
    if (!currentQuestion || submitting || selectedAnswers.length === 0) {
      return;
    }

    setFeedbackMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/mobile/sessions/${view.id}/submit`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selectedAnswers,
          }),
        },
      );

      const payload = (await response
        .json()
        .catch(() => ({}))) as PracticeSessionView & {
        message?: string;
      };

      if (!response.ok) {
        setFeedbackMessage(payload.message ?? "提交失败，请稍后重试。");
        return;
      }

      setView(payload);
    } catch {
      setFeedbackMessage("提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function nextQuestion() {
    if (advancing) {
      return;
    }

    setFeedbackMessage("");
    setAdvancing(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/mobile/sessions/${view.id}/next`),
        {
          method: "POST",
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as PracticeSessionView & {
        message?: string;
      };

      if (!response.ok) {
        setFeedbackMessage(payload.message ?? "进入下一题失败，请稍后重试。");
        return;
      }

      setView(payload);
    } catch {
      setFeedbackMessage("进入下一题失败，请稍后重试。");
    } finally {
      setAdvancing(false);
    }
  }

  async function requestAiExplanation() {
    if (!currentQuestion || !hasSubmitted || explainingAi) {
      return;
    }

    if (aiExplanation?.questionId === currentQuestion.questionId) {
      setShowAiExplanation(true);
      setAiExplanationError("");
      return;
    }

    setShowAiExplanation(true);
    setAiExplanationError("");
    setExplainingAi(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/mobile/sessions/${view.id}/analysis`),
        {
          method: "POST",
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as PracticeAiExplanationView & {
        message?: string;
      };

      if (!response.ok) {
        setAiExplanationError(payload.message ?? "AI 解析生成失败，请稍后重试。");
        return;
      }

      setAiExplanation(payload);
    } catch {
      setAiExplanationError("AI 解析生成失败，请稍后重试。");
    } finally {
      setExplainingAi(false);
    }
  }

  if (!currentQuestion) {
    return (
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <h1>练习已完成</h1>
          <p>当前会话里已经没有待作答题目，可以返回题库继续新的练习。</p>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="mobile-button is-primary"
            onClick={() =>
              busyNavigation.push("/m/banks", {
                title: "正在返回题库列表",
                description: "页面即将切换到题库列表，请稍候。",
              })
            }
          >
            返回题库列表
          </button>
          <button
            type="button"
            className="mobile-button"
            onClick={() =>
              busyNavigation.push("/m/wrong-books", {
                title: "正在打开错题本",
                description: "页面即将切换到错题本，请稍候。",
              })
            }
          >
            查看错题本
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mobile-practice-shell">
      <div className="mobile-practice-stage">
        <section className="mobile-panel mobile-practice-panel">
          <div className="mobile-page-header">
            <h1>{view.bankName}</h1>
            <p className="mobile-practice-progress">
              第 {view.currentIndex + 1} / {view.totalCount} 题
            </p>
          </div>

          <div className="list-grid">
            <div style={{ color: "var(--brand-primary)", fontWeight: 700 }}>
              {getQuestionTypeLabel(currentQuestion.type)}
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.8 }}>
              {currentQuestion.stem}
            </div>
            <div className="mobile-choice-grid">
              {currentQuestion.options.map((item) => {
                const isActive = selectedAnswers.includes(item.label);
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={
                      isActive
                        ? "mobile-choice-button is-active"
                        : "mobile-choice-button"
                    }
                    onClick={() => {
                      if (hasSubmitted || !isInteractive) {
                        return;
                      }

                      if (multiple) {
                        setSelectedAnswers((current) =>
                          current.includes(item.label)
                            ? current.filter((answer) => answer !== item.label)
                            : [...current, item.label],
                        );
                        return;
                      }

                      setSelectedAnswers([item.label]);
                    }}
                    disabled={hasSubmitted || !isInteractive || submitting || advancing}
                  >
                    {item.label}. {item.text}
                  </button>
                );
              })}
            </div>

            {!isInteractive ? (
              <div className="action-loading-notice">
                <strong>正在准备答题页面</strong>
                <span>按钮初始化完成后即可开始作答，请稍候。</span>
              </div>
            ) : null}

            {feedbackMessage ? (
              <div className="mobile-feedback is-error">{feedbackMessage}</div>
            ) : null}
          </div>
        </section>

        {hasSubmitted ? (
          <section className="mobile-panel mobile-practice-panel">
            <div className="mobile-practice-result-grid">
              <div className="mobile-practice-result-item">
                <strong>本题结果</strong>
                <span
                  style={{
                    color: currentQuestion.isCorrect
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                >
                  {currentQuestion.isCorrect ? "回答正确" : "回答错误"}
                </span>
              </div>
              <div className="mobile-practice-result-item">
                <strong>你的答案</strong>
                <span>{formatAnswerText(currentQuestion.selectedAnswers)}</span>
              </div>
              <div className="mobile-practice-result-item">
                <strong>正确答案</strong>
                <span>{formatAnswerText(currentQuestion.correctAnswers)}</span>
              </div>
              <div className="mobile-practice-result-item">
                <strong>题目解析</strong>
                <span>{currentQuestion.analysis || "暂无解析"}</span>
              </div>
              <div className="mobile-practice-result-item">
                <strong>法律来源</strong>
                <span>{currentQuestion.lawSource || "未填写"}</span>
              </div>
              <div className="mobile-practice-result-item">
                <strong>匹配法条片段</strong>
                <span>{currentQuestion.matchedExcerpt || "暂未匹配到法条内容"}</span>
              </div>
            </div>

            {showAiExplanation ? (
              <div className="mobile-ai-analysis-card">
                <h2>AI 解析</h2>
                {explainingAi ? (
                  <div className="action-loading-notice">
                    <strong>正在生成 AI 解析</strong>
                    <span>系统会基于当前题目和作答结果生成更易懂的说明。</span>
                  </div>
                ) : aiExplanationError ? (
                  <div className="mobile-feedback is-error">{aiExplanationError}</div>
                ) : aiExplanation ? (
                  <>
                    <p>{aiExplanation.content}</p>
                    <div className="mobile-ai-analysis-meta">
                      {aiExplanation.usedFallback
                        ? "当前结果使用了题目原解析和法条信息生成说明。"
                        : "当前结果由大模型结合题干、选项和你的作答生成。"}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {localBusyCopy ? (
          <div className="mobile-practice-local-mask" aria-hidden="true">
            <div className="mobile-practice-local-panel">
              <span className="mobile-practice-local-spinner" />
              <div className="mobile-practice-local-copy">
                <strong>{localBusyCopy.title}</strong>
                <span>{localBusyCopy.description}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <section className="mobile-panel mobile-practice-action-bar">
        <div className="mobile-practice-action-buttons">
          {!hasSubmitted ? (
            <button
              type="button"
              className="mobile-button is-primary"
              disabled={
                selectedAnswers.length === 0 ||
                !isInteractive ||
                submitting ||
                advancing
              }
              aria-busy={!isInteractive || submitting}
              onClick={submitAnswer}
            >
              {!isInteractive
                ? "页面准备中..."
                : submitting
                  ? "提交中..."
                  : "提交答案"}
            </button>
          ) : (
            <button
              type="button"
              className="mobile-button is-primary"
              onClick={nextQuestion}
              disabled={advancing || submitting || explainingAi || !isInteractive}
              aria-busy={advancing || !isInteractive}
            >
              {!isInteractive
                ? "页面准备中..."
                : advancing
                  ? "加载中..."
                  : "下一题"}
            </button>
          )}

          {hasSubmitted ? (
            <button
              type="button"
              className="mobile-button"
              onClick={requestAiExplanation}
              disabled={advancing || submitting || explainingAi}
              aria-busy={explainingAi}
            >
              {explainingAi ? "解析中..." : "AI解析"}
            </button>
          ) : null}

          <button
            type="button"
            className="mobile-button"
            onClick={() =>
              busyNavigation.push("/m/banks", {
                title: "正在返回题库列表",
                description: "页面即将切换到题库列表，请稍候。",
              })
            }
            disabled={submitting || advancing}
          >
            返回题库列表
          </button>
        </div>
      </section>
    </div>
  );
}

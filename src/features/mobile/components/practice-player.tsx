"use client";

import { QuestionType } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PracticeSessionView } from "@/shared/types/domain";
import { getQuestionTypeLabel } from "@/shared/utils/answers";

interface PracticePlayerProps {
  initialView: PracticeSessionView;
}

export function PracticePlayer({ initialView }: PracticePlayerProps) {
  const [view, setView] = useState(initialView);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(
    initialView.currentQuestion?.selectedAnswers ?? [],
  );
  const [isInteractive, setIsInteractive] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    setSelectedAnswers(view.currentQuestion?.selectedAnswers ?? []);
    setFeedbackMessage("");
  }, [view]);

  useEffect(() => {
    setIsInteractive(true);
  }, []);

  async function submitAnswer() {
    if (!view.currentQuestion || submitting) {
      return;
    }

    setFeedbackMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/mobile/sessions/${view.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedAnswers,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as PracticeSessionView & {
        message?: string;
      };

      if (!response.ok) {
        setFeedbackMessage(payload.message ?? "提交失败");
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
      const response = await fetch(`/api/mobile/sessions/${view.id}/next`, {
        method: "POST",
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as PracticeSessionView & {
        message?: string;
      };

      if (!response.ok) {
        setFeedbackMessage(payload.message ?? "进入下一题失败");
        return;
      }

      setView(payload);
    } catch {
      setFeedbackMessage("进入下一题失败，请稍后重试。");
    } finally {
      setAdvancing(false);
    }
  }

  if (!view.currentQuestion) {
    return (
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <h1>练习已完成</h1>
          <p>当前会话里已经没有待作答题目，可以返回题库列表继续新的练习。</p>
        </div>
        <div className="inline-actions">
          <Link
            href="/m/banks"
            className="mobile-button is-primary"
            prefetch={false}
          >
            返回题库列表
          </Link>
          <Link
            href="/m/wrong-books"
            className="mobile-button"
            prefetch={false}
          >
            查看错题本
          </Link>
        </div>
      </section>
    );
  }

  const multiple = view.currentQuestion.type === QuestionType.MULTIPLE;
  const hasSubmitted = view.currentQuestion.isCorrect !== null;

  return (
    <div
      className={
        hasSubmitted ? "list-grid mobile-practice-layout" : "list-grid"
      }
    >
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <div className="inline-actions" style={{ marginBottom: 10 }}>
            <Link
              href="/m/banks"
              className="mobile-button is-small"
              prefetch={false}
            >
              返回题库列表
            </Link>
            <Link
              href="/m/wrong-books"
              className="mobile-button is-small"
              prefetch={false}
            >
              错题本
            </Link>
          </div>
          <h1>{view.bankName}</h1>
          <p>
            第 {view.currentIndex + 1} / {view.totalCount} 题
          </p>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ color: "var(--brand-primary)", fontWeight: 700 }}>
            {getQuestionTypeLabel(view.currentQuestion.type)}
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.8 }}>
            {view.currentQuestion.stem}
          </div>
          <div className="mobile-choice-grid">
            {view.currentQuestion.options.map((item) => {
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
                  disabled={hasSubmitted || !isInteractive}
                >
                  {item.label}. {item.text}
                </button>
              );
            })}
          </div>
          {!isInteractive ? (
            <div className="action-loading-notice">
              <strong>正在准备答题页面</strong>
              <span>答题按钮初始化完成后即可开始作答，请稍候。</span>
            </div>
          ) : null}
          {feedbackMessage ? (
            <div className="mobile-feedback is-error">{feedbackMessage}</div>
          ) : null}
          {submitting ? (
            <div className="action-loading-notice">
              <strong>正在提交答案并判定结果</strong>
              <span>请稍候，系统会在判题完成后展示本题结果。</span>
            </div>
          ) : null}
          {!hasSubmitted ? (
            <button
              type="button"
              className="mobile-button is-primary is-block"
              disabled={selectedAnswers.length === 0 || !isInteractive}
              aria-busy={!isInteractive || submitting}
              onClick={submitAnswer}
            >
              {!isInteractive ? "页面准备中..." : submitting ? "提交中..." : "提交答案"}
            </button>
          ) : null}
        </div>
      </section>

      {hasSubmitted ? (
        <section className="mobile-panel" style={{ padding: 24 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <strong>本题结果：</strong>
              <span
                style={{
                  color: view.currentQuestion.isCorrect
                    ? "var(--success)"
                    : "var(--danger)",
                }}
              >
                {view.currentQuestion.isCorrect ? "回答正确" : "回答错误"}
              </span>
            </div>
            <div>
              <strong>你的答案：</strong>
              {view.currentQuestion.selectedAnswers.join("、") || "未作答"}
            </div>
            <div>
              <strong>正确答案：</strong>
              {view.currentQuestion.correctAnswers.join("、")}
            </div>
            <div>
              <strong>题目解析：</strong>
              {view.currentQuestion.analysis || "暂无解析"}
            </div>
            <div>
              <strong>法律来源：</strong>
              {view.currentQuestion.lawSource || "未填写"}
            </div>
            <div>
              <strong>匹配法条片段：</strong>
              {view.currentQuestion.matchedExcerpt || "暂未匹配到法条内容"}
            </div>
            {feedbackMessage ? (
              <div className="mobile-feedback is-error">{feedbackMessage}</div>
            ) : null}
            {advancing ? (
              <div className="action-loading-notice">
                <strong>正在加载下一题</strong>
                <span>题目加载完成后会自动更新当前页面。</span>
              </div>
            ) : null}
            <div className="inline-actions">
              <button
                type="button"
                className="mobile-button is-primary"
                onClick={nextQuestion}
                disabled={advancing || !isInteractive}
                aria-busy={advancing || !isInteractive}
              >
                {!isInteractive ? "页面准备中..." : advancing ? "加载中..." : "下一题"}
              </button>
              <Link href="/m/banks" className="mobile-button" prefetch={false}>
                返回题库列表
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

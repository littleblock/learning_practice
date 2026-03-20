"use client";

import { QuestionType } from "@prisma/client";
import { Button, Selector, Toast } from "antd-mobile";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedAnswers(view.currentQuestion?.selectedAnswers ?? []);
  }, [view]);

  async function submitAnswer() {
    if (!view.currentQuestion) {
      return;
    }

    const response = await fetch(`/api/mobile/sessions/${view.id}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selectedAnswers,
      }),
    });

    const payload = (await response.json()) as PracticeSessionView & { message?: string };

    if (!response.ok) {
      Toast.show({ icon: "fail", content: payload.message ?? "提交失败" });
      return;
    }

    setView(payload);
  }

  async function nextQuestion() {
    const response = await fetch(`/api/mobile/sessions/${view.id}/next`, {
      method: "POST",
    });
    const payload = (await response.json()) as PracticeSessionView & { message?: string };

    if (!response.ok) {
      Toast.show({ icon: "fail", content: payload.message ?? "进入下一题失败" });
      return;
    }

    startTransition(() => {
      setView(payload);
    });
  }

  if (!view.currentQuestion) {
    return (
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <h1>练习已完成</h1>
          <p>当前会话里已经没有待作答题目，可以返回题库列表继续新的练习。</p>
        </div>
        <div className="inline-actions">
          <Link href="/m/banks">
            <Button color="primary">返回题库列表</Button>
          </Link>
          <Link href="/m/wrong-books">
            <Button>查看错题本</Button>
          </Link>
        </div>
      </section>
    );
  }

  const multiple = view.currentQuestion.type === QuestionType.MULTIPLE;
  const hasSubmitted = view.currentQuestion.isCorrect !== null;

  return (
    <div className="list-grid">
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <div className="inline-actions" style={{ marginBottom: 10 }}>
            <Link href="/m/banks">
              <Button size="small">返回题库列表</Button>
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
          <div style={{ fontSize: 18, lineHeight: 1.8 }}>{view.currentQuestion.stem}</div>
          <Selector
            options={view.currentQuestion.options.map((item) => ({
              label: `${item.label}. ${item.text}`,
              value: item.label,
            }))}
            multiple={multiple}
            value={selectedAnswers}
            onChange={(value) => {
              setSelectedAnswers(multiple ? value : value.slice(-1));
            }}
            disabled={hasSubmitted}
          />
          {!hasSubmitted ? (
            <Button
              block
              color="primary"
              disabled={selectedAnswers.length === 0}
              loading={isPending}
              onClick={submitAnswer}
            >
              提交答案
            </Button>
          ) : null}
        </div>
      </section>

      {hasSubmitted ? (
        <section className="mobile-panel" style={{ padding: 24 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <strong>本题结果：</strong>
              <span style={{ color: view.currentQuestion.isCorrect ? "var(--success)" : "var(--danger)" }}>
                {view.currentQuestion.isCorrect ? "回答正确" : "回答错误"}
              </span>
            </div>
            <div>
              <strong>你的答案：</strong>
              {view.currentQuestion.selectedAnswers.join("、")}
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
            <div className="inline-actions">
              <Button color="primary" onClick={nextQuestion} loading={isPending}>
                下一题
              </Button>
              <Link href="/m/banks">
                <Button>返回题库列表</Button>
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

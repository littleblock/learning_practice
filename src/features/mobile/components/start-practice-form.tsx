"use client";

import { PracticeMode, PracticeSourceType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useMobileBusy } from "@/features/mobile/components/mobile-busy-provider";
import { withAppBasePath } from "@/shared/utils/app-path";

const options = [
  { label: "顺序练习", value: PracticeMode.SEQUENTIAL },
  { label: "倒序练习", value: PracticeMode.REVERSE },
  { label: "随机练习", value: PracticeMode.RANDOM },
];

interface StartPracticeFormProps {
  bankId: string;
  sourceType?: PracticeSourceType;
  buttonText?: string;
}

export function StartPracticeForm({
  bankId,
  sourceType = PracticeSourceType.NORMAL,
  buttonText = "开始练习",
}: StartPracticeFormProps) {
  const router = useRouter();
  const { startBusy } = useMobileBusy();
  const availableOptions = useMemo(
    () =>
      sourceType === PracticeSourceType.WRONG_BOOK
        ? options.filter((option) => option.value === PracticeMode.RANDOM)
        : options,
    [sourceType],
  );
  const [mode, setMode] = useState<PracticeMode>(
    sourceType === PracticeSourceType.WRONG_BOOK
      ? PracticeMode.RANDOM
      : PracticeMode.SEQUENTIAL,
  );
  const [isInteractive, setIsInteractive] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(
      sourceType === PracticeSourceType.WRONG_BOOK
        ? PracticeMode.RANDOM
        : PracticeMode.SEQUENTIAL,
    );
  }, [sourceType]);

  useEffect(() => {
    setIsInteractive(true);
  }, []);

  async function createSession() {
    if (isSubmitting) {
      return;
    }

    setFeedbackMessage("");
    setIsSubmitting(true);
    const busyHandle = startBusy({
      title: "正在创建练习会话",
      description: "系统正在准备题目和练习模式，完成后会自动进入答题页面。",
      keepUntilPathChange: true,
    });

    try {
      const response = await fetch(
        withAppBasePath(`/api/mobile/banks/${bankId}/sessions`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            practiceMode: mode,
            sourceType,
          }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        sessionId?: string;
      };

      if (!response.ok || !payload.sessionId) {
        busyHandle.clear();
        setFeedbackMessage(payload.message ?? "创建练习失败。");
        return;
      }

      router.push(`/m/practice/${payload.sessionId}`);
    } catch {
      busyHandle.clear();
      setFeedbackMessage("创建练习失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="mobile-choice-grid">
        {availableOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === mode
                ? "mobile-choice-button is-active"
                : "mobile-choice-button"
            }
            onClick={() => setMode(option.value)}
            disabled={!isInteractive || isSubmitting}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!isInteractive ? (
        <div className="action-loading-notice">
          <strong>正在准备练习设置</strong>
          <span>页面交互初始化完成后即可开始练习，请稍候。</span>
        </div>
      ) : null}
      <div className="page-note">
        {sourceType === PracticeSourceType.WRONG_BOOK
          ? "错题练习仅支持随机模式，便于打散记忆顺序。"
          : "重新开始练习时，会自动结束当前题库同来源的进行中会话。"}
      </div>
      {feedbackMessage ? (
        <div className="mobile-feedback is-error">{feedbackMessage}</div>
      ) : null}
      {isSubmitting ? (
        <div className="action-loading-notice">
          <strong>正在创建练习会话</strong>
          <span>系统会自动跳转到答题页，请不要重复点击开始按钮。</span>
        </div>
      ) : null}
      <button
        type="button"
        className="mobile-button is-primary is-block"
        onClick={createSession}
        disabled={!isInteractive || isSubmitting}
        aria-busy={!isInteractive || isSubmitting}
      >
        {!isInteractive
          ? "页面准备中..."
          : isSubmitting
            ? "创建中..."
            : buttonText}
      </button>
    </div>
  );
}

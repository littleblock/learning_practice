"use client";

import { PracticeMode, PracticeSourceType } from "@prisma/client";
import { Button, Selector, Toast } from "antd-mobile";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  const [mode, setMode] = useState<PracticeMode>(PracticeMode.SEQUENTIAL);
  const [isPending, startTransition] = useTransition();

  async function createSession() {
    const response = await fetch(`/api/mobile/banks/${bankId}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        practiceMode: mode,
        sourceType,
      }),
    });

    const payload = (await response.json()) as { message?: string; sessionId?: string };

    if (!response.ok || !payload.sessionId) {
      Toast.show({
        icon: "fail",
        content: payload.message ?? "创建练习失败",
      });
      return;
    }

    startTransition(() => {
      router.push(`/m/practice/${payload.sessionId}`);
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Selector
        options={options}
        value={[mode]}
        onChange={(value) => {
          const nextMode = value[0] as PracticeMode | undefined;
          if (nextMode) {
            setMode(nextMode);
          }
        }}
      />
      <div className="page-note">重新开始练习时，会自动结束当前题库同来源的进行中会话。</div>
      <Button block color="primary" onClick={createSession} loading={isPending}>
        {buttonText}
      </Button>
    </div>
  );
}

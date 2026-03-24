"use client";

import { useMobileBusyNavigation } from "@/features/mobile/components/mobile-busy-provider";

interface MobileBankEntryActionsProps {
  bankId: string;
  bankName: string;
  resumeSessionId: string | null;
}

export function MobileBankEntryActions({
  bankId,
  bankName,
  resumeSessionId,
}: MobileBankEntryActionsProps) {
  const busyNavigation = useMobileBusyNavigation();

  return (
    <div style={{ marginTop: 16 }} className="inline-actions">
      <button
        type="button"
        className="mobile-button is-primary"
        onClick={() => {
          busyNavigation.push(`/m/banks/${bankId}/setup`, {
            title: "正在打开题库",
            description: `系统正在加载“${bankName}”的练习设置，请稍候。`,
          });
        }}
      >
        进入题库
      </button>
      {resumeSessionId ? (
        <button
          type="button"
          className="mobile-button"
          onClick={() => {
            busyNavigation.push(`/m/practice/${resumeSessionId}`, {
              title: "正在继续练习",
              description: `系统正在恢复“${bankName}”的上次进度，请稍候。`,
            });
          }}
        >
          继续上次练习
        </button>
      ) : null}
    </div>
  );
}

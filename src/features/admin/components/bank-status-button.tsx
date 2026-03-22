"use client";

import { BankStatus } from "@prisma/client";
import { Button } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { withAppBasePath } from "@/shared/utils/app-path";

export function BankStatusButton({
  bankId,
  status,
  variant = "default",
}: {
  bankId: string;
  status: BankStatus;
  variant?: "default" | "table" | "menu";
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function toggleStatus() {
    if (isSubmitting) {
      return;
    }

    const nextStatus =
      status === BankStatus.ACTIVE ? BankStatus.INACTIVE : BankStatus.ACTIVE;
    const confirmed = window.confirm(
      status === BankStatus.ACTIVE
        ? "停用后学员将无法继续进入该题库，确认停用吗？"
        : "启用后学员将可以继续进入该题库，确认启用吗？",
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(withAppBasePath(`/api/admin/banks/${bankId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        window.alert(payload.message ?? "题库状态更新失败");
        return;
      }

      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      window.alert("题库状态更新失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      loading={isSubmitting || isRefreshing}
      onClick={toggleStatus}
      className={
        variant === "table"
          ? "admin-table-toggle"
          : variant === "menu"
            ? "admin-table-toggle is-menu"
            : undefined
      }
      disabled={isSubmitting || isRefreshing}
      size={variant === "menu" ? "small" : "middle"}
    >
      {status === BankStatus.ACTIVE ? "停用题库" : "启用题库"}
    </Button>
  );
}

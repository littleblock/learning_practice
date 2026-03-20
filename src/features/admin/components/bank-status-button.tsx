"use client";

import { BankStatus } from "@prisma/client";
import { Button } from "antd";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function BankStatusButton({
  bankId,
  status,
  variant = "default",
}: {
  bankId: string;
  status: BankStatus;
  variant?: "default" | "table";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function toggleStatus() {
    const nextStatus = status === BankStatus.ACTIVE ? BankStatus.INACTIVE : BankStatus.ACTIVE;

    await fetch(`/api/admin/banks/${bankId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
      }),
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Button
      loading={isPending}
      onClick={toggleStatus}
      className={variant === "table" ? "admin-table-toggle" : undefined}
    >
      {status === BankStatus.ACTIVE ? "停用题库" : "启用题库"}
    </Button>
  );
}

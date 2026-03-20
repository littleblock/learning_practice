"use client";

import { LogoutOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AdminLogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    startTransition(() => {
      router.replace("/admin/login");
      router.refresh();
    });
  }

  return (
    <Button
      block={!compact}
      type={compact ? "text" : "default"}
      icon={<LogoutOutlined />}
      aria-label="退出登录"
      className={compact ? "admin-logout-button is-compact" : "admin-logout-button"}
      loading={isPending}
      onClick={handleLogout}
    >
      {compact ? null : "退出登录"}
    </Button>
  );
}

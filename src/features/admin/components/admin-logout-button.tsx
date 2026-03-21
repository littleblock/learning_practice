"use client";

import { LogoutOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        window.alert("退出登录失败，请稍后重试");
        return;
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      window.alert("退出登录失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      block={!compact}
      type={compact ? "text" : "default"}
      icon={<LogoutOutlined />}
      aria-label="退出登录"
      className={compact ? "admin-logout-button is-compact" : "admin-logout-button"}
      loading={isSubmitting}
      onClick={handleLogout}
    >
      {compact ? null : "退出登录"}
    </Button>
  );
}

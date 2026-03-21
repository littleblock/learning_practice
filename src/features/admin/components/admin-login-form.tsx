"use client";

import { Button, Input } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminLoginHero } from "@/features/admin/components/admin-login-hero";

export function AdminLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "登录失败");
        return;
      }

      router.replace("/admin/banks");
    } catch {
      setErrorMessage("登录失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-login-layout">
      <AdminLoginHero />
      <section className="admin-panel" style={{ maxWidth: 460, padding: 28 }}>
        <div className="mobile-page-header">
          <h1>管理员登录</h1>
          <p>请输入管理员账号和密码，进入后台维护题库、题目与法条资料。</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <Input
            placeholder="管理员账号"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />
          <Input.Password
            placeholder="请输入密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          {errorMessage ? (
            <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
          ) : null}
          <Button
            type="primary"
            htmlType="submit"
            loading={isSubmitting}
            disabled={!identifier || !password}
          >
            登录后台
          </Button>
        </form>
      </section>
    </div>
  );
}

"use client";

import { Button, Input } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { AdminLoginHero } from "@/features/admin/components/admin-login-hero";

export function AdminLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRouting, startRouting] = useTransition();
  const isBusy = isSubmitting || isRouting;

  useEffect(() => {
    void router.prefetch("/admin/banks");
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    let isAuthenticated = false;

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

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "登录失败");
        return;
      }

      isAuthenticated = true;
      startRouting(() => {
        router.replace("/admin/banks");
      });
    } catch {
      setErrorMessage("登录失败，请稍后重试");
    } finally {
      if (!isAuthenticated) {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <div className="admin-login-layout">
      <AdminLoginHero />
      <section className="admin-panel admin-login-panel">
        <div className="mobile-page-header">
          <h1>管理员登录</h1>
          <p>请输入管理员账号和密码，登录后进入后台维护题库、题目与法条资料。</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <Input
            placeholder="管理员账号"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            disabled={isBusy}
          />
          <Input.Password
            placeholder="请输入密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={isBusy}
          />
          {errorMessage ? (
            <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
          ) : null}
          {isBusy ? (
            <div className="action-loading-notice" role="status" aria-live="polite">
              <strong>
                {isRouting ? "验证通过，正在进入后台" : "正在验证管理员身份"}
              </strong>
              <span>
                {isRouting
                  ? "页面即将自动跳转，请稍候。"
                  : "验证通过后会直接跳转后台，请勿重复提交。"}
              </span>
            </div>
          ) : null}
          <Button
            type="primary"
            htmlType="submit"
            loading={isBusy}
            disabled={!identifier || !password || isBusy}
          >
            登录后台
          </Button>
        </form>
      </section>
    </div>
  );
}

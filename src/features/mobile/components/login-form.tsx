"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
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
      const response = await fetch("/api/auth/login", {
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
        setErrorMessage(payload.message ?? "登录失败，请检查账号和密码。");
        return;
      }

      router.replace("/m/banks");
    } catch {
      setErrorMessage("登录请求失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mobile-panel" style={{ padding: 24 }}>
      <div className="mobile-page-header">
        <p style={{ color: "var(--brand-primary)", fontWeight: 700, marginBottom: 10 }}>
          法律刷题系统
        </p>
        <h1>欢迎回来</h1>
        <p>
          输入学习账号后即可开始刷题、查看错题本，并继续上一轮练习进度。
        </p>
      </div>

      <div className="mobile-hero-icon">法</div>

      <form onSubmit={handleSubmit}>
        <div className="mobile-form-stack">
          <input
            className="mobile-input"
            placeholder="账号或手机号"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />
          <input
            className="mobile-input"
            placeholder="请输入密码"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          {errorMessage ? (
            <div className="mobile-feedback is-error">{errorMessage}</div>
          ) : null}
          <button
            className="mobile-button is-primary is-block"
            type="submit"
            disabled={!identifier || !password || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "登录中..." : "登录"}
          </button>
          <div className="page-note">
            示例环境支持使用账号或手机号登录，登录失败时请检查账号、密码和会话配置。
          </div>
        </div>
      </form>
    </section>
  );
}

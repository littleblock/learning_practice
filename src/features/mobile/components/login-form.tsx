"use client";

import { Button, Input, Toast } from "antd-mobile";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

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

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      const message = payload.message ?? "登录失败，请检查账号和密码。";
      setErrorMessage(message);
      Toast.show({ icon: "fail", content: message });
      return;
    }

    Toast.show({ icon: "success", content: "登录成功" });
    startTransition(() => {
      router.replace("/m/banks");
    });
  }

  return (
    <section className="mobile-panel" style={{ padding: 24 }}>
      <div className="mobile-page-header">
        <p style={{ color: "var(--brand-primary)", fontWeight: 700, marginBottom: 10 }}>法律刷题系统</p>
        <h1>欢迎回来</h1>
        <p>输入学习账号后即可开始刷题、查看错题本，并继续上一次练习进度。</p>
      </div>

      <div className="mobile-hero-icon">法</div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gap: 14 }}>
          <Input placeholder="账号或手机号" value={identifier} onChange={setIdentifier} clearable />
          <Input
            placeholder="请输入密码"
            type="password"
            value={password}
            onChange={setPassword}
            clearable
          />
          {errorMessage ? (
            <div style={{ color: "var(--danger)", fontSize: 14 }}>{errorMessage}</div>
          ) : null}
          <Button
            block
            color="primary"
            type="submit"
            loading={isPending}
            disabled={!identifier || !password}
          >
            登录
          </Button>
          <div className="page-note">示例环境支持使用账号或手机号登录，登录失败时请检查账号、密码和会话配置。</div>
        </div>
      </form>
    </section>
  );
}

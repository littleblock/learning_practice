"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMobileBusy } from "@/features/mobile/components/mobile-busy-provider";
import { APP_NAME } from "@/shared/constants/app";
import { withAppBasePath } from "@/shared/utils/app-path";

export function LoginForm() {
  const router = useRouter();
  const { startBusy } = useMobileBusy();
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
    const busyHandle = startBusy({
      title: "正在登录学习账号",
      description: "系统正在校验账号和密码，验证通过后会自动进入题库列表。",
      keepUntilPathChange: true,
    });

    try {
      const response = await fetch(withAppBasePath("/api/auth/login"), {
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
        busyHandle.clear();
        setErrorMessage(payload.message ?? "登录失败，请检查账号和密码。");
        return;
      }

      router.replace("/m/banks");
    } catch {
      busyHandle.clear();
      setErrorMessage("登录请求失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mobile-panel mobile-login-panel">
      <div className="mobile-login-hero">
        <div className="mobile-login-brand">
          <span className="mobile-login-badge">{APP_NAME}</span>
          <div className="mobile-login-brand-row">
            <div className="mobile-login-logo" aria-hidden="true">
              <span>LP</span>
            </div>
            <div className="mobile-login-brand-copy">
              <strong>学习练习</strong>
              <span>更轻量的手机刷题入口</span>
            </div>
          </div>
        </div>

        <div className="mobile-login-copy">
          <h1>打开就能开始练习</h1>
          <p>登录后即可进入题库列表，继续刷题或查看错题进度。</p>
        </div>

        <div className="mobile-login-visual">
          <Image
            className="mobile-login-illustration"
            src={withAppBasePath("/mobile-login/study-scene.svg")}
            alt="学习练习登录插图"
            width={720}
            height={520}
            priority
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mobile-login-form">
        <div className="mobile-form-stack">
          <label className="mobile-login-field">
            <span>账号</span>
            <input
              className="mobile-input"
              placeholder="学习账号或手机号"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="mobile-login-field">
            <span>密码</span>
            <input
              className="mobile-input"
              placeholder="请输入登录密码"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {errorMessage ? (
            <div className="mobile-feedback is-error">{errorMessage}</div>
          ) : null}
          {isSubmitting ? (
            <div className="action-loading-notice">
              <strong>正在登录学习账号</strong>
              <span>验证通过后会自动跳转到题库列表，请不要重复点击登录按钮。</span>
            </div>
          ) : null}
          <button
            className="mobile-button is-primary is-block is-emphasis"
            type="submit"
            disabled={!identifier || !password || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "登录中..." : "登录"}
          </button>
          <div className="page-note mobile-login-note">
            联调环境建议优先使用专用测试账号，避免影响正式学习数据。
          </div>
        </div>
      </form>
    </section>
  );
}

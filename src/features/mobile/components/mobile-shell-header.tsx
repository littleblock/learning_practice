"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  useMobileBusy,
  useMobileBusyNavigation,
} from "@/features/mobile/components/mobile-busy-provider";
import { stripAppBasePath, withAppBasePath } from "@/shared/utils/app-path";

const navigationItems = [
  {
    href: "/m/banks",
    label: "题库练习",
    matchPrefixes: ["/m/banks", "/m/practice"],
    busyTitle: "正在打开题库练习",
    busyDescription: "页面即将切换到题库列表，请稍候。",
  },
  {
    href: "/m/wrong-books",
    label: "错题本",
    matchPrefixes: ["/m/wrong-books"],
    busyTitle: "正在打开错题本",
    busyDescription: "页面即将切换到错题本，请稍候。",
  },
];

export function MobileShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const busyNavigation = useMobileBusyNavigation();
  const { startBusy } = useMobileBusy();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const routePath = stripAppBasePath(pathname);

  if (!routePath || routePath === "/m/login") {
    return null;
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setErrorMessage("");
    setIsLoggingOut(true);
    const busyHandle = startBusy({
      title: "正在退出登录",
      description: "系统正在清理当前会话，完成后会自动返回登录页。",
      keepUntilPathChange: true,
    });

    try {
      const response = await fetch(withAppBasePath("/api/auth/logout"), {
        method: "POST",
      });

      if (!response.ok) {
        busyHandle.clear();
        setErrorMessage("退出失败，请稍后重试。");
        return;
      }

      router.replace("/m/login");
    } catch {
      busyHandle.clear();
      setErrorMessage("退出失败，请稍后重试。");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="mobile-shell-header">
      <nav className="mobile-shell-actions">
        {navigationItems.map((item) => {
          const isActive =
            routePath === item.href ||
            item.matchPrefixes.some((prefix) =>
              routePath.startsWith(`${prefix}/`),
            );

          return (
            <button
              key={item.href}
              type="button"
              className={
                isActive
                  ? "mobile-button is-small is-primary"
                  : "mobile-button is-small"
              }
              onClick={() => {
                if (isActive) {
                  return;
                }

                busyNavigation.push(item.href, {
                  title: item.busyTitle,
                  description: item.busyDescription,
                });
              }}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          className="mobile-button is-small"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          {isLoggingOut ? "退出中..." : "退出登录"}
        </button>
      </nav>
      {errorMessage ? (
        <div className="mobile-feedback is-error" style={{ marginTop: 12 }}>
          {errorMessage}
        </div>
      ) : null}
    </header>
  );
}

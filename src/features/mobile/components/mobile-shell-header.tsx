"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { stripAppBasePath, withAppBasePath } from "@/shared/utils/app-path";

const navigationItems = [
  {
    href: "/m/banks",
    label: "题库练习",
    matchPrefixes: ["/m/banks", "/m/practice"],
  },
  {
    href: "/m/wrong-books",
    label: "错题本",
    matchPrefixes: ["/m/wrong-books"],
  },
];

export function MobileShellHeader() {
  const pathname = usePathname();
  const router = useRouter();
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

    try {
      const response = await fetch(withAppBasePath("/api/auth/logout"), {
        method: "POST",
      });

      if (!response.ok) {
        setErrorMessage("退出失败，请稍后重试。");
        return;
      }

      router.replace("/m/login");
    } catch {
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
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={
                isActive
                  ? "mobile-button is-small is-primary"
                  : "mobile-button is-small"
              }
            >
              {item.label}
            </Link>
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

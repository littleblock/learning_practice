"use client";

import {
  DatabaseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminLogoutButton } from "@/features/admin/components/admin-logout-button";
import { APP_NAME } from "@/shared/constants/app";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "learning-practice-admin-sidebar";

interface AdminShellProps {
  activeKey: "banks";
  userName: string;
  children: React.ReactNode;
}

function NavLink({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={active ? "admin-side-link is-active" : "admin-side-link"}
      title={label}
    >
      <span className="admin-side-link-icon" aria-hidden="true">
        {icon}
      </span>
      {!collapsed ? <span>{label}</span> : null}
    </Link>
  );
}

export function AdminShell({ activeKey, userName, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    if (savedValue === "1") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSE_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  }, [collapsed]);

  return (
    <div className={collapsed ? "admin-shell is-collapsed" : "admin-shell"}>
      <aside
        className={collapsed ? "admin-sidebar is-collapsed" : "admin-sidebar"}
      >
        <div className="admin-brand">
          <div className="admin-brand-head">
            <span className="admin-brand-icon" aria-hidden="true">
              <ToolOutlined />
            </span>
            {!collapsed ? (
              <div className="admin-brand-copy">
                <h1>{APP_NAME}</h1>
                <p className="admin-brand-label">后台管理</p>
              </div>
            ) : null}
            <button
              type="button"
              className="admin-sidebar-toggle"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? "展开侧栏" : "收起侧栏"}
              title={collapsed ? "展开侧栏" : "收起侧栏"}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </div>
          {!collapsed ? (
            <span>统一维护题库、题目、资料内容与导题流程。</span>
          ) : null}
        </div>

        <nav className="admin-side-nav">
          <NavLink
            href="/admin/banks"
            label="题库管理"
            icon={<DatabaseOutlined />}
            active={activeKey === "banks"}
            collapsed={collapsed}
          />
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-account-card">
            <div className="admin-account-main">
              <div className="admin-account-info">
                <span className="admin-account-icon" aria-hidden="true">
                  <UserOutlined />
                </span>
                {!collapsed ? (
                  <div className="admin-account-meta">
                    <span>管理员</span>
                    <strong>{userName}</strong>
                  </div>
                ) : null}
              </div>
              <AdminLogoutButton compact />
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-content">{children}</div>
    </div>
  );
}

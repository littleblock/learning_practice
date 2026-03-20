import Link from "next/link";

import { AdminLogoutButton } from "@/features/admin/components/admin-logout-button";
import { APP_NAME } from "@/shared/constants/app";

interface AdminShellProps {
  activeKey: "banks";
  userName: string;
  children: React.ReactNode;
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={active ? "admin-side-link is-active" : "admin-side-link"}
    >
      {label}
    </Link>
  );
}

export function AdminShell({ activeKey, userName, children }: AdminShellProps) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-head">
            <span className="admin-brand-icon" aria-hidden="true">
              法
            </span>
            <div className="admin-brand-copy">
              <h1>{APP_NAME}</h1>
              <p className="admin-brand-label">后台管理</p>
            </div>
          </div>
          <span>统一维护题库及题库下属的题目、法条资料和导题流程。</span>
        </div>

        <nav className="admin-side-nav">
          <NavLink
            href="/admin/banks"
            label="题库管理"
            active={activeKey === "banks"}
          />
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-account-card">
            <div className="admin-account-main">
              <div className="admin-account-info">
                <span className="admin-account-icon" aria-hidden="true">
                  管
                </span>
                <div className="admin-account-meta">
                  <span>管理员</span>
                  <strong>{userName}</strong>
                </div>
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

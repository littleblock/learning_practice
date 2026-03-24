import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { BankCreateForm } from "@/features/admin/components/bank-create-form";
import { requirePageRole } from "@/server/auth/guards";

export default async function AdminBankCreatePage() {
  const session = await requirePageRole(UserRole.ADMIN, "/admin/login");

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <section className="admin-panel admin-page-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <div className="inline-actions" style={{ marginBottom: 10 }}>
            <Link href="/admin/banks" className="admin-secondary-link">
              返回题库列表
            </Link>
          </div>
          <h1>新增题库</h1>
          <p>
            提交后系统会自动生成题库编码，并可直接设置前端展示顺序，创建完成后即可继续维护题目和资料。
          </p>
        </div>

        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <span>编码规则</span>
            <strong>系统自动生成</strong>
          </div>
          <div className="admin-summary-card">
            <span>必填项</span>
            <strong>题库名称</strong>
          </div>
          <div className="admin-summary-card">
            <span>排序规则</span>
            <strong>数字越小，前端越靠前</strong>
          </div>
        </div>

        <BankCreateForm redirectTo="/admin/banks" />
      </section>
    </AdminShell>
  );
}

import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { BankCreateForm } from "@/features/admin/components/bank-create-form";
import { requirePageRole } from "@/server/auth/guards";

export default async function AdminBankCreatePage() {
  const session = await requirePageRole(UserRole.ADMIN, "/admin/login");

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <section className="admin-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <div className="inline-actions" style={{ marginBottom: 10 }}>
            <Link href="/admin/banks" className="admin-secondary-link">
              返回题库列表
            </Link>
          </div>
          <h1>新增题库</h1>
          <p>
            提交后系统会自动生成题库编码，创建完成后可继续维护题目和法条资料。
          </p>
        </div>
        <BankCreateForm redirectTo="/admin/banks" />
      </section>
    </AdminShell>
  );
}

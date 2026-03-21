import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { BankForm } from "@/features/admin/components/bank-form";
import { requirePageRole } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";

export default async function AdminBankEditPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  const session = await requirePageRole(UserRole.ADMIN, "/admin/login");
  const { bankId } = await params;
  const bank = await prisma.questionBank.findUnique({
    where: { id: bankId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <section className="admin-panel admin-page-panel" style={{ padding: 24 }}>
        {!bank ? (
          <div className="mobile-page-header">
            <h1>题库不存在</h1>
            <p>请返回题库列表重新选择。</p>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <Link href="/admin/banks" className="admin-secondary-link">
                返回题库列表
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mobile-page-header">
              <div className="inline-actions" style={{ marginBottom: 10 }}>
                <Link href="/admin/banks" className="admin-secondary-link">
                  返回题库列表
                </Link>
                <Link
                  href={`/admin/banks/${bank.id}/questions`}
                  className="admin-secondary-link"
                >
                  题目管理
                </Link>
                <Link
                  href={`/admin/banks/${bank.id}/statutes`}
                  className="admin-secondary-link"
                >
                  法条资料管理
                </Link>
              </div>
              <h1>编辑题库</h1>
              <p>
                当前页面仅允许修改题库名称、简介和排序值，题库编码保持只读。
              </p>
            </div>

            <div className="admin-summary-grid">
              <div className="admin-summary-card">
                <span>当前编码</span>
                <strong>{bank.code}</strong>
              </div>
              <div className="admin-summary-card">
                <span>维护内容</span>
                <strong>名称、简介、排序</strong>
              </div>
              <div className="admin-summary-card">
                <span>快捷入口</span>
                <strong>题目管理与法条资料</strong>
              </div>
            </div>

            <BankForm
              mode="edit"
              bankId={bank.id}
              redirectTo="/admin/banks"
              initialValues={{
                code: bank.code,
                name: bank.name,
                description: bank.description,
                sortOrder: bank.sortOrder,
              }}
            />
          </>
        )}
      </section>
    </AdminShell>
  );
}

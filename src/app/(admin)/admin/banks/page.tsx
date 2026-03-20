import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { BankFilters } from "@/features/admin/components/admin-filters";
import { BankListTable } from "@/features/admin/components/bank-list-table";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { requirePageRole } from "@/server/auth/guards";
import { listBanksForAdmin } from "@/server/services/bank-service";

export default async function AdminBanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePageRole(UserRole.ADMIN, "/admin/login");
  const query = await searchParams;
  const result = await listBanksForAdmin(query);
  const keyword = typeof query.keyword === "string" ? query.keyword : "";
  const status = typeof query.status === "string" ? query.status : "";

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <section className="admin-panel admin-page-panel" style={{ padding: 28 }}>
        <div className="admin-section-header">
          <div className="mobile-page-header">
            <h1>题库管理</h1>
            <p>查看全部题库，支持按名称、编码和状态快速筛选。</p>
          </div>
          <Link href="/admin/banks/new" className="admin-primary-link">
            + 新增题库
          </Link>
        </div>

        <BankFilters keyword={keyword} status={status} />

        <p className="page-note" style={{ marginTop: 14 }}>
          当前共匹配到 {result.total} 个题库。
        </p>

        <AdminPagination
          basePath="/admin/banks"
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          query={{ keyword, status }}
        />

        {result.items.length === 0 ? (
          <section className="admin-empty-state">
            当前筛选条件下没有题库结果。
          </section>
        ) : (
          <BankListTable
            banks={result.items.map((bank) => ({
              id: bank.id,
              code: bank.code,
              name: bank.name,
              description: bank.description,
              sortOrder: bank.sortOrder,
              status: bank.status,
              questionCount: bank._count.questions,
              statuteDocumentCount: bank._count.statuteDocuments,
            }))}
          />
        )}
      </section>
    </AdminShell>
  );
}

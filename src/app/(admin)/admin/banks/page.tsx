import { UserRole } from "@prisma/client";
import Link from "next/link";

import { BankFilters } from "@/features/admin/components/admin-filters";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { BankListTable } from "@/features/admin/components/bank-list-table";
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
      <section className="admin-panel admin-page-panel admin-summary-section">
        <div className="admin-section-header">
          <div className="admin-page-header-copy">
            <h1>题库管理</h1>
            <p>集中维护题库入口、前端展示顺序、启用状态、题目规模和资料规模。</p>
          </div>
          <Link href="/admin/banks/new" className="admin-primary-link">
            新增题库
          </Link>
        </div>

        <div className="admin-summary-grid is-compact">
          <div className="admin-summary-card is-inline">
            <span>题库总数</span>
            <strong>{result.summary.bankTotal}</strong>
          </div>
          <div className="admin-summary-card is-inline">
            <span>已启用题库数</span>
            <strong>{result.summary.activeBankTotal}</strong>
          </div>
          <div className="admin-summary-card is-inline">
            <span>已启用题目数</span>
            <strong>{result.summary.activeQuestionTotal}</strong>
          </div>
        </div>
      </section>

      <section className="admin-panel admin-page-panel admin-list-section">
        <div className="admin-section-header is-compact">
          <div>
            <h2>题库列表</h2>
            <p className="page-note">支持按名称、编码和状态筛选，并查看前端展示排序值。</p>
          </div>
        </div>

        <BankFilters
          keyword={keyword}
          status={status}
          pageSize={String(result.pageSize)}
        />

        <div className="admin-inline-status-row">
          <p className="page-note" style={{ margin: 0 }}>
            当前共匹配到 {result.total} 个题库。
          </p>
        </div>

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

        <AdminPagination
          basePath="/admin/banks"
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          query={{ keyword, status }}
        />
      </section>
    </AdminShell>
  );
}

import { UserRole } from "@prisma/client";
import Link from "next/link";

import { QuestionManager } from "@/features/admin/components/question-manager";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { requirePageRole } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { listQuestionImportBatchesForAdmin } from "@/server/services/question-import-service";
import { listQuestionsForAdmin } from "@/server/services/question-service";

export default async function AdminQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ bankId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePageRole(UserRole.ADMIN, "/admin/login");
  const { bankId } = await params;
  const query = await searchParams;
  const bank = await prisma.questionBank.findUnique({
    where: { id: bankId },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!bank) {
    return (
      <AdminShell activeKey="banks" userName={session.user.displayName}>
        <section className="admin-panel admin-page-panel" style={{ padding: 28 }}>
          <div className="mobile-page-header">
            <h1>题库不存在</h1>
            <p>当前题库可能已被删除或无权访问，请返回题库列表重新选择。</p>
          </div>
          <div className="inline-actions">
            <Link href="/admin/banks" className="admin-secondary-link">
              返回题库列表
            </Link>
          </div>
        </section>
      </AdminShell>
    );
  }

  const keyword = typeof query.keyword === "string" ? query.keyword : "";
  const type = typeof query.type === "string" ? query.type : "";
  const lawSource = typeof query.lawSource === "string" ? query.lawSource : "";
  const activeTab =
    query.tab === "imports" || query.tab === "questions"
      ? query.tab
      : "questions";
  const recordPage = typeof query.recordPage === "string" ? query.recordPage : "1";
  const recordPageSize =
    typeof query.recordPageSize === "string" ? query.recordPageSize : "10";

  const [questionResult, importBatchResult] = await Promise.all([
    listQuestionsForAdmin(bank.id, query),
    listQuestionImportBatchesForAdmin(
      bank.id,
      Number.parseInt(recordPage, 10) || 1,
      Number.parseInt(recordPageSize, 10) || 10,
    ),
  ]);

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <div className="list-grid">
        <section className="admin-panel admin-page-panel" style={{ padding: 28 }}>
          <div className="mobile-page-header">
            <div className="inline-actions" style={{ marginBottom: 12 }}>
              <Link href="/admin/banks" className="admin-secondary-link">
                返回题库列表
              </Link>
              <Link
                href={`/admin/banks/${bank.id}/edit`}
                className="admin-secondary-link"
              >
                编辑题库
              </Link>
              <Link
                href={`/admin/banks/${bank.id}/statutes`}
                className="admin-secondary-link"
              >
                法条资料
              </Link>
            </div>
            <h1>{bank.name} / 题目管理</h1>
            <p>
              题库编码：{bank.code}。支持分页查看、单题维护、Excel 导题解析和逐行失败判定。
            </p>
          </div>
        </section>

        <QuestionManager
          bankId={bank.id}
          questions={questionResult.items}
          nextSortOrder={questionResult.nextSortOrder}
          importBatches={importBatchResult.items}
          importBatchPage={importBatchResult.page}
          importBatchPageSize={importBatchResult.pageSize}
          importBatchTotal={importBatchResult.total}
          questionQuery={{
            keyword,
            type,
            lawSource,
            page: String(questionResult.page),
            pageSize: String(questionResult.pageSize),
            recordPage: String(importBatchResult.page),
            recordPageSize: String(importBatchResult.pageSize),
            tab: activeTab,
          }}
          activeTab={activeTab}
          questionPage={questionResult.page}
          questionPageSize={questionResult.pageSize}
          questionTotal={questionResult.total}
          keyword={keyword}
          type={type}
          lawSource={lawSource}
          recordPage={String(importBatchResult.page)}
          recordPageSize={String(importBatchResult.pageSize)}
        />
      </div>
    </AdminShell>
  );
}

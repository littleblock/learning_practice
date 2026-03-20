import { UserRole } from "@prisma/client";

import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { QuestionFilters } from "@/features/admin/components/admin-filters";
import { QuestionImportForm } from "@/features/admin/components/question-import-form";
import { QuestionManager } from "@/features/admin/components/question-manager";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { requirePageRole } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { listRecentQuestionImportJobs } from "@/server/services/job-service";
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
    },
  });

  if (!bank) {
    return <div>题库不存在。</div>;
  }

  const keyword = typeof query.keyword === "string" ? query.keyword : "";
  const type = typeof query.type === "string" ? query.type : "";
  const lawSource = typeof query.lawSource === "string" ? query.lawSource : "";
  const questionResult = await listQuestionsForAdmin(bank.id, query);
  const importJobs = await listRecentQuestionImportJobs(bank.id);

  return (
    <AdminShell activeKey="questions" userName={session.user.displayName} bankId={bank.id}>
      <div className="list-grid">
        <section className="admin-panel" style={{ padding: 24 }}>
          <div className="mobile-page-header">
            <h1>{bank.name} / 题目管理</h1>
            <p>支持 Excel 导题、题目筛选，以及单题新增、编辑和删除。</p>
          </div>
          <QuestionFilters bankId={bank.id} keyword={keyword} type={type} lawSource={lawSource} />
          <p className="page-note" style={{ marginTop: 14 }}>
            当前筛选到 {questionResult.total} 道题目。
          </p>
          <AdminPagination
            basePath={`/admin/banks/${bank.id}/questions`}
            page={questionResult.page}
            pageSize={questionResult.pageSize}
            total={questionResult.total}
            query={{ keyword, type, lawSource }}
          />
        </section>

        <section className="admin-panel" style={{ padding: 24 }}>
          <div className="mobile-page-header">
            <h1 style={{ fontSize: 22 }}>Excel 导题</h1>
            <p>上传模板后系统会异步解析文件，并在导入完成后重建法条匹配结果。</p>
          </div>
          <QuestionImportForm bankId={bank.id} />
          <div style={{ marginTop: 18 }} className="list-grid">
            <strong>最近导入任务</strong>
            {importJobs.length === 0 ? <span className="page-note">当前还没有导入记录。</span> : null}
            {importJobs.map((job) => (
              <div key={job.id} className="stat-card">
                <div>文件名：{job.fileName}</div>
                <div>
                  状态：{job.status} | 尝试次数：{job.attempts}/{job.maxAttempts}
                </div>
                <div>提交时间：{new Date(job.createdAt).toLocaleString("zh-CN")}</div>
                {job.finishedAt ? (
                  <div>结束时间：{new Date(job.finishedAt).toLocaleString("zh-CN")}</div>
                ) : null}
                {job.lastError ? <div style={{ color: "var(--danger)" }}>错误：{job.lastError}</div> : null}
              </div>
            ))}
          </div>
        </section>

        {questionResult.items.length === 0 ? (
          <section className="admin-panel" style={{ padding: 24 }}>
            当前筛选结果为空，可以调整筛选条件，或者先通过导题和新增功能补充题目。
          </section>
        ) : null}

        <QuestionManager bankId={bank.id} questions={questionResult.items} />
      </div>
    </AdminShell>
  );
}

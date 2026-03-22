import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { DeleteDocumentButton } from "@/features/admin/components/delete-document-button";
import { StatuteUploadForm } from "@/features/admin/components/statute-upload-form";
import { requirePageRole } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { listStatuteDocuments } from "@/server/services/statute-service";
import { formatDateTime, getDocumentStatusLabel } from "@/shared/utils/format";

export default async function AdminStatutesPage({
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
        <section className="admin-panel admin-page-panel admin-page-section">
          <div className="admin-page-backline">
            <Link href="/admin/banks" className="admin-text-link">
              返回题库列表
            </Link>
          </div>
          <div className="admin-page-header-copy is-compact">
            <h1>题库不存在</h1>
            <p>当前题库可能已被删除或无权访问，请返回题库列表重新选择。</p>
          </div>
        </section>
      </AdminShell>
    );
  }

  const documents = await listStatuteDocuments(bank.id, query);

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <section className="admin-panel admin-page-panel admin-page-section">
        <div className="admin-page-backline">
          <Link href="/admin/banks" className="admin-text-link">
            返回题库列表
          </Link>
        </div>
        <div className="admin-page-header-copy is-compact">
          <h1>{bank.name}</h1>
          <p>题库编码 {bank.code}，当前页面用于上传和管理资料文件。</p>
        </div>

        <div className="admin-summary-grid is-compact">
          <div className="admin-summary-card is-inline">
            <span>资料总数</span>
            <strong>{documents.total}</strong>
          </div>
          <div className="admin-summary-card is-inline">
            <span>处理方式</span>
            <strong>异步解析</strong>
          </div>
          <div className="admin-summary-card is-inline">
            <span>当前用途</span>
            <strong>答案匹配</strong>
          </div>
        </div>

        <p className="page-note">
          系统会在资料上传后异步抽取文本切片，并重建当前题库的资料匹配结果。
        </p>

        <div style={{ marginTop: 16 }}>
          <StatuteUploadForm bankId={bank.id} />
        </div>
      </section>

      {documents.items.length === 0 ? (
        <section className="admin-panel admin-page-panel admin-page-section">
          当前还没有上传任何资料文件。
        </section>
      ) : (
        <section className="admin-panel admin-page-panel admin-page-section">
          <div className="admin-table-wrap">
            <table className="admin-table is-import-table">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>资料标题</th>
                  <th style={{ width: "22%" }}>文件名</th>
                  <th style={{ width: 120 }}>状态</th>
                  <th style={{ width: 110 }}>大小</th>
                  <th style={{ width: 168 }}>上传时间</th>
                  <th style={{ width: "22%" }}>错误信息</th>
                  <th style={{ width: 132 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {documents.items.map((document) => (
                  <tr key={document.id}>
                    <td title={document.title}>{document.title}</td>
                    <td title={document.fileName}>{document.fileName}</td>
                    <td>{getDocumentStatusLabel(document.status)}</td>
                    <td>{Math.ceil(document.fileSize / 1024)} KB</td>
                    <td>{formatDateTime(document.createdAt)}</td>
                    <td title={document.lastError || "-"}>
                      {document.lastError || "-"}
                    </td>
                    <td className="admin-table-actions-cell">
                      <DeleteDocumentButton documentId={document.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminPagination
            basePath={`/admin/banks/${bank.id}/statutes`}
            page={documents.page}
            pageSize={documents.pageSize}
            total={documents.total}
          />
        </section>
      )}
    </AdminShell>
  );
}

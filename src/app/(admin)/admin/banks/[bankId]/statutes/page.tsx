import { UserRole } from "@prisma/client";
import Link from "next/link";

import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { DeleteDocumentButton } from "@/features/admin/components/delete-document-button";
import { StatuteUploadForm } from "@/features/admin/components/statute-upload-form";
import { requirePageRole } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { listStatuteDocuments } from "@/server/services/statute-service";

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
    return <div>题库不存在。</div>;
  }

  const documents = await listStatuteDocuments(bank.id, query);

  return (
    <AdminShell activeKey="banks" userName={session.user.displayName}>
      <div className="list-grid">
        <section className="admin-panel" style={{ padding: 24 }}>
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
                href={`/admin/banks/${bank.id}/questions`}
                className="admin-secondary-link"
              >
                题目管理
              </Link>
            </div>
            <h1>{bank.name} / 法条资料管理</h1>
            <p>题库编码：{bank.code}。支持上传、删除和查看资料处理状态。</p>
          </div>
          <p className="page-note">
            系统会在资料上传后异步抽取文本切片，并重建当前题库的法条匹配结果。
          </p>
          <div style={{ marginTop: 16 }}>
            <AdminPagination
              basePath={`/admin/banks/${bank.id}/statutes`}
              page={documents.page}
              pageSize={documents.pageSize}
              total={documents.total}
            />
          </div>
          <div style={{ marginTop: 18 }}>
            <StatuteUploadForm bankId={bank.id} />
          </div>
        </section>

        {documents.items.length === 0 ? (
          <section className="admin-panel" style={{ padding: 24 }}>
            当前还没有上传任何法条资料。
          </section>
        ) : null}

        {documents.items.map((document) => (
          <section
            key={document.id}
            className="admin-panel"
            style={{ padding: 24 }}
          >
            <div className="mobile-page-header">
              <h1 style={{ fontSize: 22 }}>{document.title}</h1>
              <p>
                文件名：{document.fileName} | 状态：{document.status} | 大小：
                {Math.ceil(document.fileSize / 1024)} KB
              </p>
            </div>
            {document.lastError ? (
              <div style={{ color: "var(--danger)" }}>{document.lastError}</div>
            ) : null}
            <DeleteDocumentButton documentId={document.id} />
          </section>
        ))}
      </div>
    </AdminShell>
  );
}

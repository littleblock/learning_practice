import { BankStatus } from "@prisma/client";
import { Button } from "antd";
import Link from "next/link";

import { BankStatusButton } from "@/features/admin/components/bank-status-button";

interface BankManagementCardProps {
  bank: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    status: BankStatus;
    questionCount: number;
    statuteDocumentCount: number;
  };
}

export function BankManagementCard({ bank }: BankManagementCardProps) {
  return (
    <section className="admin-panel" style={{ padding: 24 }}>
      <div className="mobile-page-header">
        <h1 style={{ fontSize: 24 }}>{bank.name}</h1>
        <p>
          编码：{bank.code} | 状态：
          {bank.status === BankStatus.ACTIVE ? "启用" : "停用"} | 排序：
          {bank.sortOrder}
        </p>
      </div>

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        <div className="stat-card">
          题目数量
          <strong>{bank.questionCount}</strong>
        </div>
        <div className="stat-card">
          法条资料数量
          <strong>{bank.statuteDocumentCount}</strong>
        </div>
      </div>

      <p className="page-note" style={{ marginTop: 16 }}>
        {bank.description || "暂无题库简介。"}
      </p>

      <div className="inline-actions" style={{ marginTop: 16 }}>
        <BankStatusButton bankId={bank.id} status={bank.status} />
        <Link href={`/admin/banks/${bank.id}/edit`}>
          <Button>编辑题库</Button>
        </Link>
        <Link href={`/admin/banks/${bank.id}/questions`}>题目管理</Link>
        <Link href={`/admin/banks/${bank.id}/statutes`}>法条资料管理</Link>
      </div>
    </section>
  );
}

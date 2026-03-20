import { BankStatus } from "@prisma/client";
import Link from "next/link";

import { BankStatusButton } from "@/features/admin/components/bank-status-button";

interface BankListTableProps {
  banks: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    status: BankStatus;
    questionCount: number;
    statuteDocumentCount: number;
  }>;
}

function getStatusLabel(status: BankStatus) {
  return status === BankStatus.ACTIVE ? "已启用" : "已停用";
}

export function BankListTable({ banks }: BankListTableProps) {
  return (
    <div className="admin-table-wrap" style={{ marginTop: 18 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>编码</th>
            <th>状态</th>
            <th>排序</th>
            <th>题目</th>
            <th>法条</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {banks.map((bank) => (
            <tr key={bank.id}>
              <td>
                <div className="admin-table-title">{bank.name}</div>
                <div className="admin-table-note">{bank.description || "暂无题库简介"}</div>
              </td>
              <td>{bank.code}</td>
              <td>
                <span
                  className={
                    bank.status === BankStatus.ACTIVE
                      ? "admin-status-pill is-active"
                      : "admin-status-pill is-inactive"
                  }
                >
                  {getStatusLabel(bank.status)}
                </span>
              </td>
              <td>{bank.sortOrder}</td>
              <td>{bank.questionCount}</td>
              <td>{bank.statuteDocumentCount}</td>
              <td className="admin-table-actions-cell">
                <div className="admin-table-actions">
                  <div className="admin-table-action-links">
                    <Link href={`/admin/banks/${bank.id}/edit`} className="admin-table-link">
                      编辑
                    </Link>
                    <span className="admin-table-action-divider">|</span>
                    <Link href={`/admin/banks/${bank.id}/questions`} className="admin-table-link">
                      题目管理
                    </Link>
                    <span className="admin-table-action-divider">|</span>
                    <Link href={`/admin/banks/${bank.id}/statutes`} className="admin-table-link">
                      法条资料
                    </Link>
                  </div>
                  <div className="admin-table-action-row">
                    <BankStatusButton bankId={bank.id} status={bank.status} variant="table" />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

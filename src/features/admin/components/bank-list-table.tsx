import { BankStatus } from "@prisma/client";
import Link from "next/link";

import { BankMoreActions } from "@/features/admin/components/bank-more-actions";

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
    <div className="admin-table-wrap">
      <table className="admin-table is-bank-table">
        <thead>
          <tr>
            <th style={{ width: "34%" }}>题库名称</th>
            <th style={{ width: 176 }}>编码</th>
            <th style={{ width: 108 }}>状态</th>
            <th style={{ width: 84 }}>排序</th>
            <th style={{ width: 96 }}>题目数</th>
            <th style={{ width: 96 }}>资料数</th>
            <th style={{ width: 260 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {banks.map((bank) => (
            <tr key={bank.id}>
              <td>
                <div className="admin-table-title">{bank.name}</div>
                <div className="admin-table-note">
                  {bank.description || "暂无题库简介"}
                </div>
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
                <div className="admin-table-actions is-compact">
                  <div className="admin-table-action-links">
                    <Link
                      href={`/admin/banks/${bank.id}/questions`}
                      className="admin-table-link"
                      prefetch={false}
                    >
                      题目管理
                    </Link>
                    <span className="admin-table-action-divider">/</span>
                    <Link
                      href={`/admin/banks/${bank.id}/statutes`}
                      className="admin-table-link"
                      prefetch={false}
                    >
                      资料管理
                    </Link>
                  </div>
                  <BankMoreActions
                    bankId={bank.id}
                    editHref={`/admin/banks/${bank.id}/edit`}
                    status={bank.status}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

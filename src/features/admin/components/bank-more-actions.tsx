import { BankStatus } from "@prisma/client";
import Link from "next/link";

import { BankStatusButton } from "@/features/admin/components/bank-status-button";

export function BankMoreActions({
  bankId,
  editHref,
  status,
}: {
  bankId: string;
  editHref: string;
  status: BankStatus;
}) {
  return (
    <details className="admin-table-more">
      <summary className="admin-table-more-trigger">更多</summary>
      <div className="admin-table-more-menu">
        <Link href={editHref} className="admin-table-more-link" prefetch={false}>
          编辑题库
        </Link>
        <BankStatusButton bankId={bankId} status={status} variant="menu" />
      </div>
    </details>
  );
}

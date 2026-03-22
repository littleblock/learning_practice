import { UserRole } from "@prisma/client";
import Link from "next/link";

import { StartPracticeForm } from "@/features/mobile/components/start-practice-form";
import { requirePageRole } from "@/server/auth/guards";
import { getBankSetup } from "@/server/services/bank-service";

export default async function PracticeSetupPage({
  params,
}: {
  params: Promise<{ bankId: string }>;
}) {
  await requirePageRole(UserRole.LEARNER, "/m/login");
  const { bankId } = await params;
  const bank = await getBankSetup(bankId);

  if (!bank) {
    return (
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <h1>题库不可用</h1>
          <p>当前题库不存在或已停用，请返回题库列表重新选择。</p>
        </div>
        <Link href="/m/banks" className="mobile-button" prefetch={false}>
          返回题库列表
        </Link>
      </section>
    );
  }

  return (
    <section className="mobile-panel" style={{ padding: 24 }}>
      <div className="mobile-page-header">
        <div className="inline-actions" style={{ marginBottom: 10 }}>
          <Link
            href="/m/banks"
            className="mobile-button is-small"
            prefetch={false}
          >
            返回题库列表
          </Link>
        </div>
        <h1>{bank.name}</h1>
        <p>开始练习前请选择本次题目的出题顺序。</p>
      </div>
      <StartPracticeForm bankId={bank.id} />
    </section>
  );
}

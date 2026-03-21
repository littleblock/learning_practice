import { UserRole } from "@prisma/client";
import Link from "next/link";

import { PracticePlayer } from "@/features/mobile/components/practice-player";
import { requirePageRole } from "@/server/auth/guards";
import { getPracticeSessionView } from "@/server/services/practice-service";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await requirePageRole(UserRole.LEARNER, "/m/login");
  const { sessionId } = await params;

  try {
    const view = await getPracticeSessionView(session.user.id, sessionId);
    return <PracticePlayer initialView={view} />;
  } catch {
    return (
      <section className="mobile-panel" style={{ padding: 24 }}>
        <div className="mobile-page-header">
          <h1>练习会话不可用</h1>
          <p>当前会话可能已失效、已完成或不存在，请返回题库列表重新开始。</p>
        </div>
        <div className="inline-actions">
          <Link href="/m/banks" className="mobile-button is-primary">
            返回题库列表
          </Link>
          <Link href="/m/wrong-books" className="mobile-button">
            查看错题本
          </Link>
        </div>
      </section>
    );
  }
}

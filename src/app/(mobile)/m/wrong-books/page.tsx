import { UserRole } from "@prisma/client";
import Link from "next/link";
import { Button } from "antd-mobile";

import { WrongBookStartButton } from "@/features/mobile/components/wrong-book-start-button";
import { requirePageRole } from "@/server/auth/guards";
import { listWrongBookSummaries } from "@/server/services/bank-service";

export default async function WrongBooksPage() {
  const session = await requirePageRole(UserRole.LEARNER, "/m/login");
  const wrongBooks = await listWrongBookSummaries(session.user.id);

  return (
    <div className="list-grid">
      <section className="mobile-page-header">
        <h1>错题本</h1>
        <p>这里会汇总当前仍在错题本中的题目，可直接继续上次会话或重新开始专项练习。</p>
      </section>

      <Link href="/m/banks">返回题库列表</Link>

      {wrongBooks.length === 0 ? (
        <section className="mobile-panel" style={{ padding: 24 }}>
          当前没有待复习的错题。
        </section>
      ) : null}

      {wrongBooks.map((item) => (
        <section key={item.bankId} className="mobile-panel" style={{ padding: 24 }}>
          <div className="mobile-page-header">
            <h1 style={{ fontSize: 22 }}>{item.bankName}</h1>
            <p>
              错题数量：{item.wrongCount}
              {item.lastAnsweredAt ? ` | 最近答题时间：${new Date(item.lastAnsweredAt).toLocaleString("zh-CN")}` : ""}
            </p>
          </div>
          <p className="page-note">当前状态：{item.latestPracticeStatus}</p>
          <div className="inline-actions" style={{ marginTop: 14 }}>
            {item.resumeSessionId ? (
              <Link href={`/m/practice/${item.resumeSessionId}`}>
                <Button>继续上次错题练习</Button>
              </Link>
            ) : null}
          </div>
          <div style={{ marginTop: 14 }}>
            <WrongBookStartButton bankId={item.bankId} />
          </div>
        </section>
      ))}
    </div>
  );
}

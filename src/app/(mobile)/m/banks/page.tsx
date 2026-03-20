import { UserRole } from "@prisma/client";
import Link from "next/link";
import { Button } from "antd-mobile";

import { requirePageRole } from "@/server/auth/guards";
import { listMobileBankSummaries } from "@/server/services/bank-service";

export default async function MobileBanksPage() {
  const session = await requirePageRole(UserRole.LEARNER, "/m/login");
  const banks = await listMobileBankSummaries(session.user.id);

  return (
    <div className="list-grid">
      <section className="mobile-page-header">
        <h1>题库列表</h1>
        <p>你好，{session.user.displayName}。可以从这里开始新的练习，也可以继续上次进度。</p>
      </section>

      <Link href="/m/wrong-books">
        <Button block>进入错题本</Button>
      </Link>

      {banks.length === 0 ? (
        <section className="mobile-panel" style={{ padding: 24 }}>
          当前暂无可用题库，请联系管理员导入题目后再开始练习。
        </section>
      ) : null}

      {banks.map((bank) => (
        <section key={bank.id} className="mobile-panel" style={{ padding: 20 }}>
          <div className="mobile-page-header">
            <h1 style={{ fontSize: 22 }}>{bank.name}</h1>
            <p>{bank.description || "暂无题库简介"}</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              总题量
              <strong>{bank.totalQuestions}</strong>
            </div>
            <div className="stat-card">
              已做题数
              <strong>{bank.answeredQuestions}</strong>
            </div>
            <div className="stat-card">
              正确率
              <strong>{(bank.accuracyRate * 100).toFixed(0)}%</strong>
            </div>
            <div className="stat-card">
              错题数
              <strong>{bank.wrongBookCount}</strong>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="progress-row">
              <span>练习进度</span>
              <strong>{(bank.progressRate * 100).toFixed(0)}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(bank.progressRate * 100, 100)}%` }} />
            </div>
          </div>

          <div style={{ marginTop: 16 }} className="inline-actions">
            <Link href={`/m/banks/${bank.id}/setup`}>
              <Button color="primary">进入题库</Button>
            </Link>
            {bank.resumeSessionId ? (
              <Link href={`/m/practice/${bank.resumeSessionId}`}>
                <Button>继续上次练习</Button>
              </Link>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

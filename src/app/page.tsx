import Link from "next/link";

const featureItems = [
  "学员端支持题库练习、错题本和继续上次练习。",
  "管理端支持题库维护、题目编辑、Excel 导题和法条资料上传。",
  "导题支持 AI 识别非标准表格，并提供确认列表后再正式入库。",
];

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <p className="landing-eyebrow">Learning Practice MVP</p>
        <h1>法律刷题与后台管理</h1>
        <p className="landing-description">
          前台提供移动端刷题、错题本与继续练习，后台提供题库、题目和法条资料维护。
        </p>
        <div className="landing-actions">
          <Link href="/m/login" className="landing-primary">
            进入学员端
          </Link>
          <Link href="/admin/login" className="landing-secondary">
            进入管理端
          </Link>
        </div>
        <div className="landing-feature-list">
          {featureItems.map((item) => (
            <div key={item} className="landing-feature-item">
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

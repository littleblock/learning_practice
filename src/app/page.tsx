import Link from "next/link";

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
      </section>
    </main>
  );
}

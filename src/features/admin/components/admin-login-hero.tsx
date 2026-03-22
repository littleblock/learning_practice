import { APP_NAME } from "@/shared/constants/app";

export function AdminLoginHero() {
  return (
    <section className="admin-login-hero">
      <p>后台管理</p>
      <h1>{APP_NAME}后台</h1>
      <span>
        统一维护题库、题目和资料内容，支持 Excel 导题、资料解析和匹配任务处理。
      </span>
    </section>
  );
}

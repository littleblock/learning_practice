# 法律刷题工具 MVP

基于 `Next.js App Router + TypeScript + Prisma + PostgreSQL(pgvector)` 的单仓项目，包含：

- 前台移动端 H5：登录、题库列表、练习设置、刷题、错题本
- 后台管理端：管理员登录、题库管理、题目管理、法条资料管理
- 异步 Worker：Excel 导题、法条切片、向量化、题目与法条最佳匹配重建

## 目录结构

```text
src/
  app/
    (mobile)/
    (admin)/
    api/
  features/
  shared/
  server/
prisma/
```

## 本地运行

1. 安装依赖

```bash
npx pnpm@10.8.0 install
```

2. 配置环境变量

基于 `.env.example` 创建 `.env.local`，至少填写：

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_BASE_URL`

如未配置 `AI_API_KEY`，系统会退化为本地确定性向量，便于开发联调。

3. 生成 Prisma Client 并执行迁移

```bash
npx pnpm@10.8.0 run prisma:generate
npx pnpm@10.8.0 run prisma:migrate
npx pnpm@10.8.0 run db:seed
```

4. 启动开发环境

默认只需要执行一个命令，系统会同时启动：

- Web 进程：同时承载学员端 `/m/*` 和管理端 `/admin/*`
- Worker 进程：处理 Excel 导题、法条切片和匹配重建等异步任务

```bash
npx pnpm@10.8.0 run dev
```

如果你只想单独调页面，不需要异步任务，也可以只启动 Web：

```bash
npx pnpm@10.8.0 run dev:web
```

默认示例账号：

- 学员：`learner01 / Learner123456`
- 管理员：`admin / Admin123456`

## 常用命令

```bash
npx pnpm@10.8.0 run lint
npx pnpm@10.8.0 run typecheck
npx pnpm@10.8.0 run test
npx pnpm@10.8.0 run build
```

## 说明

- `prisma/migrations/20260318230000_init/migration.sql` 已包含 `pgvector` 扩展初始化。
- Excel 导题采用异步任务，上传后会进入 `Job` 队列表。
- 法条匹配只在导题、编辑题目、上传法条后离线重建，答题时直接读取缓存结果。

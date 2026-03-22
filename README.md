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

## 生产部署约束

当前阿里云生产服务器是低内存环境，而且还同时运行其他 PM2 服务。这个项目虽然业务上不复杂，但 `Next.js 15 + App Router + Ant Design + Prisma` 的生产构建阶段内存占用并不低，已经实测会在服务器上触发 OOM kill。因此，后续发布时不要把“登录服务器后直接执行 `pnpm build`”当成默认方案。

推荐的固定发布流程如下：

1. 在本地完成代码修改。
2. 在本地执行 `npx pnpm@10.8.0 run typecheck`、测试和必要的页面验证。
3. 在本地执行生产构建。
4. 将源码、生产环境变量和构建产物上传到服务器。
5. 服务器只执行 `prisma migrate deploy`、替换 `.next` 产物、`pm2 restart` 和 Nginx reload。

当前生产环境约定如下：

- 公网入口：`https://www.superconsultant.cn/apps/learning-practice`
- 项目目录：`/app/learning_practice`
- 上传目录：`/data/learning_practice/uploads`
- PM2 进程：`learning-practice-web`、`learning-practice-worker`
- 生产环境变量文件：`/app/learning_practice/.env.production.local`
- Nginx 配置文件：`/etc/nginx/conf.d/sc_platform.conf`

如果必须在低内存环境临时构建，至少要显式带上下面两个限制项，但这仍然不是默认推荐方式：

```bash
NEXT_BUILD_CPUS=1
NEXT_WEBPACK_BUILD_WORKER=false
```

生产环境必须确保以下变量已经写入 `.env.production.local`：

```bash
NEXT_PUBLIC_BASE_PATH=/apps/learning-practice
APP_BASE_URL=https://www.superconsultant.cn/apps/learning-practice
COOKIE_SECURE=true
UPLOAD_DIR=/data/learning_practice/uploads
```

所有大模型和对象存储相关的链接、密钥、模型名、并发参数，也都必须放在环境变量中，不能直接写入代码仓库。

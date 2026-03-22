# AGENTS.md

## Documentation Principles

The goal of comments is to make the current system behavior understandable for both engineers and product stakeholders, and to allow PRD or system documentation to be generated from the codebase.

Comments must describe the **current design and intent**, not the historical evolution of the code.

Always prioritize clarity and maintainability over comment quantity.

In addition to documentation quality, code structure must remain clear and scalable:

- Do **NOT** generate single-page components that simulate routing through local state switching.
- Every page must be implemented as an **independent file**.
- Navigation and page switching must be handled by the **router**, not by manually toggling page state inside one component.

---

## Documentation Language

- All code comments and docstrings must be written in **Simplified Chinese**.
- All files must use **UTF-8 encoding** to avoid character corruption.
- Comments should be written in **clear and professional Chinese** suitable for engineers and product managers.
- Avoid slang, emojis, or informal language.

---

## Comment Scope Rules

Structured comments should **only be written for stable business logic**, including:

- business rules
- domain services
- validation logic
- cross-module workflows
- public APIs
- complex algorithms
- important edge cases

Do **NOT** add structured comments for minor or frequently changing code such as:

- UI layout adjustments
- modal or dialog changes
- table column additions or ordering
- field label or display changes
- styling or spacing updates
- experimental or temporary code

Simple UI-related code may use **a single short comment at most**.

---

## Comment Update Rules

- When modifying a feature, **update existing comments instead of adding new ones**.
- Remove comments that no longer match the implementation.
- If a feature has been modified multiple times, **consolidate explanations into one clean description of the current behavior**.
- Do **not record change history or iteration steps inside comments**. Git is the source of history.

---

## Page and Routing Rules

- Do **NOT** implement multiple pages inside one file by switching views with `useState`, conditional rendering, tab state, step state, or similar mechanisms when the intent is actual page navigation.
- Each page must be a **separate file** under the proper page or route directory.
- Shared layout parts may be extracted into reusable components, but **pages themselves must stay independent**.
- All navigation between pages must be managed by the application's **routing system**.
- Do **NOT** fake routing behavior inside a single component for convenience.

---

## Deployment Rules

### 阿里云生产部署约束

- 当前生产服务器为低内存环境，同时还运行其他 PM2 服务。
- 对这个项目来说，服务器上的 `pnpm build` / `next build` 不是默认安全操作。
- 即使业务功能较简单，`Next.js 15 + App Router + Ant Design + Prisma` 的生产构建阶段仍然会明显占用内存，已经实测会被系统 OOM kill。
- 因此，**默认部署策略必须是“本地或 CI 构建，服务器只运行产物”**，不要把“在服务器直接构建”当成常规流程。

### 默认发布流程

1. 在本地完成代码修改。
2. 在本地执行测试和类型检查。
3. 在本地执行生产构建。
4. 将代码与构建产物上传到服务器。
5. 服务器仅执行依赖准备、数据库迁移、替换构建产物、`pm2 restart` 和 Nginx reload。

### 本项目当前生产部署约定

- 公网入口：`https://www.superconsultant.cn/apps/learning-practice`
- 项目目录：`/app/learning_practice`
- 上传目录：`/data/learning_practice/uploads`
- PM2 进程：
  - `learning-practice-web`
  - `learning-practice-worker`
- Nginx 配置文件：`/etc/nginx/conf.d/sc_platform.conf`
- 生产环境变量文件：`/app/learning_practice/.env.production.local`

### 构建与环境变量要求

- 生产构建默认在本地或 CI 执行，不在服务器执行。
- 生产环境必须使用路径前缀：
  - `NEXT_PUBLIC_BASE_PATH=/apps/learning-practice`
  - `APP_BASE_URL=https://www.superconsultant.cn/apps/learning-practice`
  - `COOKIE_SECURE=true`
- 如果确实需要在低内存环境临时构建，必须显式限制构建并发：
  - `NEXT_BUILD_CPUS=1`
  - `NEXT_WEBPACK_BUILD_WORKER=false`
- 大模型链接、密钥、模型名、拆题并发参数、OSS 配置都必须写入 `.env.production.local`，不得硬编码到代码、PM2 启动命令或 Nginx 配置中。

### 禁止事项

- 不要默认在服务器执行 `pnpm build`。
- 不要把未构建的源码直接覆盖到生产目录后就重启服务。
- 不要把 AI key、OSS key、数据库连接串写进仓库文件。
- 不要修改根路径 `/` 去替换旧站，当前新应用只允许挂在 `/apps/learning-practice`。

---

## Comment Structure (for Business Logic)

When structured comments are required, follow the format below:

```python
"""
功能说明：
描述该功能的核心作用。

业务背景：
解释业务目的或产品需求背景。

核心逻辑：
简要说明关键实现思路。

关键约束：
说明重要限制条件、边界情况或特殊处理。
"""
```

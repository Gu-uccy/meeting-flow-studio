# Meeting Flow Studio

Meeting Flow Studio 是一个面向团队会议协作的流程编排工作台。它将会议申请、议程生成、上下文查询、审批节点、日历同步、运行记录和会后行动项抽象成一条可视化的 Meeting Flow，让会议不再只是日程，而是可以配置、运行、追踪和复盘的业务流程。

这个项目适合作为全栈简历项目展示：前端包含高密度 SaaS 工作台、可视化流程画布和节点配置体验；后端提供认证、权限、会议数据、工作流模板、运行记录、日历集成和调度执行能力；共享包负责沉淀前后端通用类型、schema、种子数据和默认工作流模板。

## 项目亮点

- 可视化会议流程编排：基于 React Flow 实现流程画布、节点状态、连线状态、画布聚焦缩放和节点配置。
- 会议工作台：包含会议队列、筛选排序、会议详情、议程、参会人、待办事项和流程操作区。
- 工作流运行模型：支持工作流模板、节点运行状态、阻塞处理、重试、取消、运行日志和配置快照。
- 全局运行控制台：跨会议、跨模板查看运行状态，处理阻塞与失败任务。
- 模板生命周期：支持模板 CRUD、导入导出、版本快照、发布与回滚。
- 知识库与向量检索：支持知识文档上传，纳入会议记忆向量索引。
- 节点智能体工作室：Prompt / Schema / 映射 / 版本 / Debug 一体化配置。
- 对外 Service API：应用级 API Key，支持外部系统触发已发布工作流。
- 认证与权限：基于 JWT 的登录注册、会话校验和 admin / editor / viewer 角色能力。
- 账号集成总览：AI、Google、飞书、向量索引、Service API Key 统一管理与状态展示。
- 日历集成：提供 Google Calendar / Meet 和飞书日历 OAuth 接入、授权状态展示和会议同步。
- AI-ready 节点：AI 节点可接入 Anthropic；未配置密钥时使用本地模拟输出，便于演示和开发。
- Monorepo 工程化：使用 pnpm workspace 管理 web、api、shared 三个 package，统一构建、类型检查和测试。
- CI 覆盖：GitHub Actions 在 push / pull request 时执行安装、测试、构建和 Playwright E2E。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | React, TypeScript, Vite, React Flow |
| 后端 | Fastify, TypeScript, JWT, bcryptjs, node-cron |
| 数据 | SQLite（开发默认）/ PostgreSQL（生产推荐），Repository 抽象 |
| 类型与校验 | Zod, shared package |
| 日历集成 | Google Calendar API, Feishu/Lark Calendar API |
| AI 节点 | Anthropic SDK，OpenAI Embedding（可选） |
| 工程化 | pnpm workspace, GitHub Actions, Playwright E2E |

## 核心功能

### 会议工作台

- 查看会议队列、状态、优先级、组织者和会议时间。
- 支持搜索、筛选、排序和会议状态切换。
- 支持新建、编辑、删除会议。
- 展示会议议程、参会人、待办事项和当前流程运行状态。

### 流程画布

- 支持多类工作流模板选择与编辑模式工具栏（新建、复制、导入导出）。
- 基于 React Flow 展示节点、连线、运行态和阻塞态。
- 点击画布后进入鼠标焦点状态，只有聚焦时滚轮才会缩放画布。
- 支持新增节点、拖拽节点、连接节点、保存画布和放弃修改。
- 模板版本管理：保存快照、发布版本、Diff 对比与回滚（编辑模式底部面板，默认折叠）。
- 节点配置面板支持编辑标题、描述、类型、负责人、输入输出和配置字段。

### 工作流运行

- 支持从当前会议启动工作流，异步 Job 队列执行。
- 支持查看运行摘要、运行日志、节点执行时间线和延迟瀑布图。
- 支持阻塞节点处理、失败重试和取消运行。
- 支持保存运行时的配置快照，用于对比当前模板配置。
- 全局运行控制台：按状态 / 模板 / 会议筛选，跨视图处理阻塞任务。

### 知识库与集成

- 知识文档上传，纳入向量检索索引。
- 拓展工具面板：节点能力矩阵、记忆与知识配置。
- 账号页集成总览：平台统计与 Service API Key 管理。
- 对外 Service API：`POST /api/v1/apps/{id}/run` 触发已发布应用工作流。

### 外部日历

- Google Calendar / Meet：
  - 支持 OAuth 授权 URL 生成。
  - 支持 token 保存和刷新。
  - 支持创建或更新会议日历事件。
  - 可生成 Google Meet 会议链接。
- 飞书日历：
  - 支持 OAuth 授权 URL 生成。
  - 支持 token 保存和刷新。
  - 支持同步会议到飞书日历。
- 未配置真实 OAuth 参数时，会降级为本地 mock 同步结果，方便演示。

## 项目结构

```text
meeting-flow-studio/
  apps/
    api/                 Fastify API 服务
      src/
        lib/db/          数据库抽象（SQLite / PostgreSQL）
        repositories/    JSON 文档型 Repository
        routes/          模块化 API 路由
        services/        认证、执行器、日历、AI、调度等业务服务
        server.ts        API 入口
    web/                 React + Vite 前端工作台
      src/
        components/      workbench、meetings、workflow 组件
        contexts/        工作台与认证上下文
        hooks/           会议、工作流、知识库 hooks
        lib/             工具函数与测试
  packages/
    shared/              前后端共享类型、Zod schema、种子数据和模板
  .github/workflows/     CI 配置
```

## 架构概览

```mermaid
flowchart LR
  User["用户 / 团队成员"] --> Web["React 工作台"]
  Web --> API["Fastify API"]
  API --> Auth["JWT 认证与权限"]
  API --> MeetingStore["会议 Store"]
  API --> WorkflowStore["工作流 Store"]
  API --> Executor["工作流执行器"]
  Executor --> AI["AI 节点 / Anthropic 或 Mock"]
  API --> Calendar["Google / 飞书日历集成"]
  API --> ServiceAPI["Service API / 外部触发"]
  MeetingStore --> DB["SQLite / PostgreSQL"]
  WorkflowStore --> DB
  Auth --> DB
  Shared["shared package: 类型、schema、种子数据"] --> Web
  Shared --> API
```

## 快速开始

### 环境要求

- Node.js 22+
- pnpm 11.7.0+

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm dev
```

默认访问地址：

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://127.0.0.1:5173` |
| 后端 | `http://127.0.0.1:8787` |

### 默认账号

默认种子账号密码均为 `admin123`：

| 角色 | 邮箱 | 说明 |
| --- | --- | --- |
| 管理员 | `admin@meetingflow.local` | 可管理全部会议和流程 |
| 编辑者 | `editor@meetingflow.local` | 可编辑自己有权限的会议 |
| 观察者 | `viewer@meetingflow.local` | 偏查看权限 |

## 常用命令

```bash
pnpm dev          # 同时启动 api 和 web
pnpm dev:api      # 只启动后端
pnpm dev:web      # 只启动前端
pnpm typecheck    # 全仓库类型检查
pnpm test         # 类型检查 + 单元测试
pnpm verify:postgres  # PostgreSQL 集成验证（Docker 或 embedded 回退）
pnpm build        # 全仓库构建
```

## 环境变量

可以参考 `apps/api/.env.example` 创建 `apps/api/.env`。

| 变量 | 说明 |
| --- | --- |
| `PORT` | API 端口，默认 `8787` |
| `HOST` | API 监听地址，默认 `127.0.0.1` |
| `JWT_SECRET` | JWT 签名密钥，生产环境必须覆盖 |
| `DB_DRIVER` | 数据库驱动，`sqlite`（默认）或 `postgres` |
| `DATABASE_URL` | PostgreSQL 连接串（生产使用 Postgres 时必填） |
| `ANTHROPIC_API_KEY` | 可选，配置后 AI 节点调用 Anthropic |
| `OPENAI_API_KEY` | 可选，向量 Embedding（未配置时使用本地 hash 降级） |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth 回调地址 |
| `FEISHU_APP_ID` | 飞书应用 ID |
| `FEISHU_APP_SECRET` | 飞书应用密钥 |
| `FEISHU_REDIRECT_URI` | 飞书 OAuth 回调地址 |
| `FEISHU_CALENDAR_ID` | 飞书日历 ID，默认 `primary` |
| `FEISHU_OAUTH_SCOPES` | 飞书授权 scope |

## Google Calendar 接入

1. 在 Google Cloud Console 创建项目。
2. 启用 Google Calendar API。
3. 创建 OAuth Client，应用类型选择 Web application。
4. 在 Authorized redirect URIs 中加入：

```text
http://127.0.0.1:8787/api/integrations/google/callback
```

5. 在 `apps/api/.env` 中配置：

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:8787/api/integrations/google/callback
```

6. 在工作台的日历接入区域点击连接 Google，授权后即可同步会议。

当前使用 `https://www.googleapis.com/auth/calendar.events` scope，仅创建或更新由本应用同步的日历事件。参会人目前只有姓名字段，第一版会写入事件描述，不会自动发送 Google Calendar 邀请邮件。

## 飞书日历与视频会议接入

1. 在飞书开放平台创建应用。
2. 启用日历与视频会议相关权限（含录制只读）。
3. 配置 OAuth 回调地址：

```text
http://127.0.0.1:8787/api/integrations/feishu/callback
```

4. 在 `apps/api/.env` 中配置：

```bash
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_REDIRECT_URI=http://127.0.0.1:8787/api/integrations/feishu/callback
FEISHU_CALENDAR_ID=primary
FEISHU_OAUTH_SCOPES="calendar:calendar calendar:calendar.event:create vc:meeting.meetingevent:read vc:record:readonly minutes:minutes.transcript:export"
FEISHU_VERIFICATION_TOKEN=
# Optional. If set, encrypted event payloads are not supported yet — leave empty for local webhook.
# FEISHU_ENCRYPT_KEY=
```

5. 在工作台连接飞书并授权后：
   - **同步飞书会议**：写入日历事件，并创建飞书视频会议（默认开启自动录制）
   - **刷新录制状态**：会后解析 `meeting_id`、拉取录制，并尝试导出妙记转写；若纪要节点因缺录音阻塞，会自动继续
6. （可选）在飞书开放平台配置事件订阅，请求地址：

```text
http://127.0.0.1:8787/api/integrations/feishu/events
```

订阅 `vc.meeting.recording_ready_v1`，并设置 `FEISHU_VERIFICATION_TOKEN` 与开放平台校验 Token 一致（本地建议关闭加密）。

## 本地数据

开发环境默认使用 SQLite，数据写入：

```text
apps/api/data/meetings.db
```

生产环境推荐使用 PostgreSQL，详见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

数据库文件是本地运行产物，已被 `.gitignore` 忽略。删除 SQLite 文件后再次启动 API，会重新写入种子用户、种子会议和默认工作流模板。

## CI

仓库包含 GitHub Actions 配置：

```text
.github/workflows/ci.yml
```

CI 会在 push 到 `main` 或创建 pull request 时执行：

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm --filter @meeting-flow/web test:e2e
```

## 简历描述参考

```text
Meeting Flow Studio｜会议流程编排工作台
技术栈：React, TypeScript, Vite, React Flow, Fastify, JWT, SQLite/PostgreSQL, pnpm workspace

- 设计并实现面向团队会议协作的流程编排平台，将会议申请、议程生成、上下文查询、审批节点、日历同步和会后行动项抽象为可视化工作流。
- 基于 React Flow 实现流程画布，支持模板编辑、版本快照/回滚、运行状态可视化、全局运行控制台和阻塞节点处理。
- 使用 Fastify 构建后端 API，完成认证权限、Repository 持久化层、异步工作流 Job、知识库向量检索和 Service API 对外调用。
- 采用 pnpm workspace 搭建 monorepo，将类型、schema 和种子数据沉淀到 shared package；CI 覆盖单元测试与 Playwright E2E。
- 接入 Google Calendar / 飞书日历，并提供账号集成总览与生产部署文档（单实例 / PostgreSQL）。
```

## 后续规划

- 分布式 Job 队列（Redis/Bull）与多实例水平扩展。
- 插件化 Tool 注册与更完整的节点能力运行时。
- 向量索引增量更新与 Postgres 集成测试纳入 CI。
- 详见 [DEPLOYMENT.md](./DEPLOYMENT.md) 了解部署方式、`pnpm verify:postgres` 与已知限制。

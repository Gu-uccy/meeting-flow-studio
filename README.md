# Meeting Flow Studio

Meeting Flow Studio 是一个面向会议全流程编排的可视化工作台。它把会议申请、议程生成、上下文收集、审批规则、通知分发、运行日志和会后行动项放进同一套可运行的 Meeting Flow 中。

## 项目结构

```text
apps/
  api/      Fastify 后端服务，提供认证、会议、工作流和调度接口
  web/      Vite + React + React Flow 前端工作台
packages/
  shared/   前后端共享类型、Zod schema、种子数据和默认工作流模板
```

## 技术栈

- 前端：React、Vite、React Flow、TypeScript
- 后端：Fastify、JWT、bcryptjs、node-cron、SQLite、TypeScript
- 共享层：Zod、workspace package
- 包管理：pnpm workspace
- 可选 AI：Anthropic SDK，通过 `ANTHROPIC_API_KEY` 启用

## 当前能力

- 登录、注册和基于 JWT 的会话校验。
- 内置管理员、编辑者、观察者角色，并按会议归属计算操作权限。
- 会议列表、筛选、排序、新建、编辑、状态变更和删除。
- SQLite 本地持久化会议、用户、工作流模板、运行记录和计划任务。
- 工作流模板库、React Flow 画布预览、节点配置和画布保存。
- 工作流运行、阻塞节点处理、失败重试、取消运行和运行日志查看。
- Cron 计划任务触发工作流运行。
- Google Calendar / Meet 接入骨架：完成 Google OAuth 后，可把会议同步到 Google 日历并生成 Meet 链接。
- AI 节点支持 Anthropic 调用；未配置密钥时使用模拟输出，便于本地开发。

## 快速开始

安装依赖：

```bash
pnpm install
```

启动前后端开发环境：

```bash
pnpm dev
```

默认访问地址：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:8787`

默认种子账号密码均为 `admin123`：

- `admin@meetingflow.local`
- `editor@meetingflow.local`
- `viewer@meetingflow.local`

## 常用命令

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm dev:web
pnpm dev:api
```

## 本地数据

开发数据默认写入 `apps/api/data/meetings.db`。该文件是本地运行产物，已在 `.gitignore` 中忽略；删除它后再次启动 API 会重新写入种子数据。

## 环境变量

- `PORT`：API 端口，默认 `8787`
- `HOST`：API 监听地址，默认 `127.0.0.1`
- `JWT_SECRET`：JWT 签名密钥，本地有默认值，生产环境必须覆盖
- `ANTHROPIC_API_KEY`：可选，配置后 AI 节点会调用 Anthropic
- `GOOGLE_CLIENT_ID`：Google Cloud OAuth Client ID
- `GOOGLE_CLIENT_SECRET`：Google Cloud OAuth Client Secret
- `GOOGLE_REDIRECT_URI`：Google OAuth 回调地址，默认 `http://127.0.0.1:8787/api/integrations/google/callback`

## Google Calendar 接入

1. 在 Google Cloud Console 创建项目，并启用 Google Calendar API。
2. 创建 OAuth Client，应用类型选择 Web application。
3. 在 Authorized redirect URIs 中加入 `http://127.0.0.1:8787/api/integrations/google/callback`。
4. 启动 API 前设置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和可选的 `GOOGLE_REDIRECT_URI`。
5. 在工作台右侧“真实会议接入”卡片点击“连接 Google”，授权后点击“同步到日历”。

当前版本使用 `https://www.googleapis.com/auth/calendar.events` scope，只创建/更新由本应用同步的日历事件。参会人目前只有姓名字段，没有邮箱字段，因此第一版会把参会人写进事件描述，不会自动发送 Google Calendar 邀请。

## 后续建议

1. 增加面向 API 的集成测试，覆盖认证、权限、会议 CRUD 和工作流运行。
2. 为前端关键表单和工作流画布增加组件测试或端到端测试。
3. 把本地 SQLite 存储抽象成可替换的 repository，便于迁移到生产数据库。
4. 为工作流节点执行器增加更严格的输入输出 schema 和错误分类。

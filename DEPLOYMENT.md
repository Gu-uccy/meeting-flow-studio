# 部署说明

Meeting Flow Studio 当前适合**单实例**部署。多实例水平扩展前请先完成队列与数据库迁移（见 README 后续规划）。

## 环境要求

- Node.js 22+
- pnpm 11+
- 数据库：**SQLite**（默认，可写目录 `apps/api/data/`）或 **PostgreSQL**（生产推荐）

## 数据库配置

| 变量 | 说明 |
|------|------|
| `DB_DRIVER` | `sqlite`（默认）或 `postgres` |
| `SQLITE_PATH` | SQLite 文件路径，默认 `apps/api/data/meetings.db` |
| `DATABASE_URL` | PostgreSQL 连接串（`DB_DRIVER=postgres` 时**生产必填**） |
| `DB_SSL` | PostgreSQL 是否启用 SSL，默认 `false` |
| `DB_POOL_MAX` | PostgreSQL 连接池上限，默认 `10` |

本地开发无需配置，默认使用 SQLite。生产环境若使用 PostgreSQL，需设置 `DB_DRIVER=postgres` 与 `DATABASE_URL`。

## 必填环境变量（生产）

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | 设为 `production` |
| `JWT_SECRET` | 随机长字符串，**不可使用默认值** |
| `DATABASE_URL` | 使用 PostgreSQL 时必填 |
| `AI_KEY_ENCRYPTION_SECRET` | 可选，建议与 JWT 独立；用于加密用户 LLM Key |

## 推荐环境变量

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | 服务端默认 LLM Key（用户未配置时使用） |
| `OPENAI_API_KEY` | 向量 Embedding（未配置时使用本地 hash 降级） |
| `HOST` / `PORT` | API 监听地址，默认 `127.0.0.1:8787` |
| `SCHEDULER_ENABLED` | 设为 `false` 可关闭 Cron（多实例时仅一台应为 `true`） |
| `LOG_LEVEL` | 默认 `info` |

## 单实例启动

```bash
pnpm install
pnpm --filter @meeting-flow/shared build
pnpm --filter @meeting-flow/api build
pnpm --filter @meeting-flow/web build

# API
cd apps/api
NODE_ENV=production JWT_SECRET=<your-secret> node dist/server.js

# Web（静态资源 + 反向代理）
cd apps/web
pnpm preview --host 0.0.0.0 --port 5173
```

生产环境请在前置反向代理（Nginx/Caddy）中：

- 将 `/api` 与 `/health` 转发到 API 服务
- 将 `/api/ws/workflows` 升级为 WebSocket
- 将前端静态资源指向 `apps/web/dist`

## Service API 调用

1. 登录后在 `POST /api/apps/:id/service-keys` 创建密钥（仅创建时返回完整 key）
2. 使用 Bearer 调用：

```http
POST /api/v1/apps/{applicationId}/run
Authorization: Bearer mfs_sk_...
Content-Type: application/json

{
  "meetingId": "meeting-001",
  "templateId": "optional-template-id"
}
```

返回 `202`，工作流在后台异步执行；可通过 WebSocket 或 `GET /api/workflows/runs/:id` 查询状态。

## 安全清单

- [ ] 已设置强随机 `JWT_SECRET`
- [ ] 未将 `.env` 或 `apps/api/data/` 提交到版本库
- [ ] 多副本部署时仅一个实例启用 `SCHEDULER_ENABLED`
- [ ] 反向代理已配置 WebSocket 升级
- [ ] HTTPS 已启用（生产）

## 已知限制

- 工作流 Job 队列与取消状态保存在**进程内存**，重启后丢失进行中的 cancel 标记
- SQLite 单文件，不适合高并发写入；生产建议使用 PostgreSQL
- 用户 LLM Key 与 OAuth Token 存储在同一数据库中

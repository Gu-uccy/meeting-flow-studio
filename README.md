# Meeting Flow Studio

Meeting Flow Studio is a React Flow based visual AI meeting operations platform inspired by Zapier. It helps teams orchestrate meeting intake, agenda generation, context gathering, stakeholder coordination, reminders, summaries, action items, and post-meeting follow-up on a node-based workflow canvas.

一个基于 React Flow 的类 Zapier 可视化智能会议管理平台，支持会议创建、编排协同、AI 摘要、通知提醒、任务分发与会后跟进。

## Workspace

```text
apps/
  api/      Fastify API for workflow and meeting orchestration
  web/      Vite + React Flow editor UI
packages/
  shared/   Shared types, schemas, and starter workflow blueprints
```

## Quick start

```bash
cmd /c pnpm install
cmd /c pnpm dev
```

Frontend default URL: `http://127.0.0.1:5173`

Backend default URL: `http://127.0.0.1:8787`

## Suggested next steps

1. Add authentication and workspace/member modeling.
2. Persist workflow graphs and meeting artifacts to a database.
3. Connect the action nodes to calendar, email, and conference APIs.
4. Layer AI copilots for agenda generation, note synthesis, and follow-up drafting.

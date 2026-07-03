import Fastify from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import {
  createMeetingSchema,
  defaultWorkflowBlueprint,
  loginInputSchema,
  meetingFlowProduct,
  meetingIntakeSchema,
  meetingNodeCatalog,
  meetingStatusLabels,
  registerInputSchema,
  type MeetingRecord,
  type MeetingRecordWithPermissions,
  type PublicUser,
  updateMeetingSchema,
  updateMeetingStatusSchema,
  type CreateMeetingInput,
  type EditableMeetingInput,
  type MeetingDashboardSummary,
  type MeetingStatus,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate,
  type UpdateMeetingInput
} from "@meeting-flow/shared";
import { loadMeetings, saveMeetings } from "./meetingStore.js";
import { loadWorkflowRuns, loadWorkflowTemplates, saveWorkflowRuns, saveWorkflowTemplates } from "./workflowStore.js";
import { loadUsers, migrateExistingMeetings } from "./userStore.js";
import { getIntegrationAccount } from "./integrationStore.js";
import {
  buildPermissions,
  createAuthPreHandler,
  loginUser,
  registerUser
} from "./services/auth.js";
import { executeWorkflowRun, advanceWorkflowExecution } from "./services/executor.js";
import { startScheduler, getAllSchedules, addSchedule, removeSchedule } from "./services/scheduler.js";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleConfig,
  syncGoogleCalendarEvent
} from "./services/googleCalendar.js";
import {
  buildFeishuAuthUrl,
  exchangeFeishuCode,
  getMissingFeishuCalendarScopes,
  getFeishuConfig,
  syncFeishuCalendarEvent
} from "./services/feishuCalendar.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

const jwtSecret = process.env["JWT_SECRET"] ?? "meeting-flow-dev-secret-change-in-production";
await app.register(fjwt, {
  secret: jwtSecret
});

let meetings: MeetingRecord[] = await loadMeetings();
let workflowRuns: ProductWorkflowRun[] = await loadWorkflowRuns();
let workflowTemplates: ProductWorkflowTemplate[] = await loadWorkflowTemplates();

await loadUsers();
await migrateExistingMeetings();

const authenticate = createAuthPreHandler();

function sortByUpdatedAtDesc(left: MeetingRecord, right: MeetingRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function sortRunsByStartedAtDesc(left: ProductWorkflowRun, right: ProductWorkflowRun) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

function buildMeetingSummary(items: MeetingRecord[]): MeetingDashboardSummary {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === "draft").length,
    scheduled: items.filter((item) => item.status === "scheduled").length,
    inProgress: items.filter((item) => item.status === "in_progress").length,
    completed: items.filter((item) => item.status === "completed").length,
    cancelled: items.filter((item) => item.status === "cancelled").length
  };
}

function findMeeting(id: string) {
  return meetings.find((item) => item.id === id);
}

function normalizeStatus(value: unknown): MeetingStatus | "all" {
  if (value === "all") {
    return "all";
  }

  const parsed = updateMeetingStatusSchema.shape.status.safeParse(value);
  return parsed.success ? parsed.data : "all";
}

function normalizeText(value: string) {
  return value.trim();
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean))];
}

function durationBetween(startAt: string, endAt: string) {
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Math.max(15, Math.round(diff / 60000));
}

function hasValidMeetingWindow(startAt: string, endAt: string) {
  return new Date(startAt).getTime() < new Date(endAt).getTime();
}

function assignIds<T extends Record<string, unknown>>(items: T[], prefix: string) {
  return items.map((item, index) => ({
    ...item,
    id: `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`
  }));
}

function sanitizeMeetingInput(input: EditableMeetingInput) {
  return {
    ...input,
    title: normalizeText(input.title),
    host: normalizeText(input.host),
    owner: normalizeText(input.owner),
    description: normalizeText(input.description),
    meetingGoal: normalizeText(input.meetingGoal),
    location: normalizeText(input.location),
    meetingLink: normalizeText(input.meetingLink),
    recurrence: normalizeText(input.recurrence),
    notes: input.notes.trim(),
    minutes: input.minutes.trim(),
    tags: normalizeTags(input.tags),
    participants: input.participants.map((participant) => ({
      ...participant,
      name: normalizeText(participant.name)
    })),
    agendaItems: input.agendaItems.map((agendaItem) => ({
      ...agendaItem,
      title: normalizeText(agendaItem.title)
    })),
    actionItems: input.actionItems.map((actionItem) => ({
      ...actionItem,
      content: normalizeText(actionItem.content),
      owner: normalizeText(actionItem.owner),
      dueDate: normalizeText(actionItem.dueDate)
    }))
  };
}

function validateMeetingInput(input: {
  startAt: string;
  endAt: string;
  isRecurring: boolean;
  recurrence: string;
}) {
  if (!hasValidMeetingWindow(input.startAt, input.endAt)) {
    return "结束时间必须晚于开始时间";
  }

  if (input.isRecurring && !input.recurrence.trim()) {
    return "重复会议需要填写重复规则";
  }

  return "";
}

function buildMeetingRecord(
  input: EditableMeetingInput,
  options: { id?: string; createdAt?: string; submittedAt?: string; ownerUserId?: string }
): MeetingRecord {
  const now = new Date().toISOString();
  const sanitized = sanitizeMeetingInput(input);

  return {
    id: options.id ?? `meeting-${Date.now()}`,
    ...sanitized,
    ownerUserId: options.ownerUserId ?? "",
    startAt: new Date(sanitized.startAt).toISOString(),
    endAt: new Date(sanitized.endAt).toISOString(),
    participants: assignIds(sanitized.participants, "participant"),
    agendaItems: assignIds(sanitized.agendaItems, "agenda"),
    actionItems: assignIds(sanitized.actionItems, "action"),
    attendeeCount: sanitized.participants.length,
    durationMinutes: durationBetween(sanitized.startAt, sanitized.endAt),
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    submittedAt: options.submittedAt ?? (sanitized.status === "draft" ? "" : now)
  };
}

function createMeetingRecord(input: CreateMeetingInput, ownerUserId?: string): MeetingRecord {
  const status = input.submissionMode === "save" ? "draft" : "scheduled";

  return buildMeetingRecord(
    {
      ...input,
      status,
      minutes: "",
      actionItems: [],
      notifications: {
        inviteSent: input.submissionMode === "submit",
        reminderSent: false,
        changeNotified: false
      }
    },
    { ownerUserId }
  );
}

function updateMeetingRecord(meeting: MeetingRecord, input: UpdateMeetingInput): MeetingRecord {
  return buildMeetingRecord(input, {
    id: meeting.id,
    createdAt: meeting.createdAt,
    ownerUserId: meeting.ownerUserId,
    submittedAt:
      input.status === "draft"
        ? meeting.submittedAt
        : meeting.submittedAt || new Date().toISOString()
  });
}

function selectWorkflowTemplate(meeting: MeetingRecord, templateId?: string) {
  return (
    (templateId ? workflowTemplates.find((template) => template.id === templateId) : null) ??
    workflowTemplates.find((template) => template.category === meeting.type) ??
    workflowTemplates[0]
  );
}

async function createWorkflowRun(meeting: MeetingRecord, template: ProductWorkflowTemplate) {
  return executeWorkflowRun(meeting, template);
}

// ── Helper: attach permissions to meeting records ──

function attachPermissions(meeting: MeetingRecord, user?: PublicUser): MeetingRecordWithPermissions {
  return {
    ...meeting,
    permissions: user
      ? buildPermissions(user, meeting)
      : { canCreate: false, canEdit: false, canCancel: false, canDelete: false, canViewMinutes: false }
  };
}

function attachPermissionsToItems(items: MeetingRecord[], user?: PublicUser): MeetingRecordWithPermissions[] {
  return items.map((item) => attachPermissions(item, user));
}

// ── Auth routes ──

app.post("/api/auth/register", async (request, reply) => {
  const payload = registerInputSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "注册参数不合法",
      issues: payload.error.flatten()
    });
  }

  try {
    const result = await registerUser(app, payload.data.email, payload.data.password, payload.data.name);
    return reply.code(201).send(result);
  } catch (error) {
    return reply.code(409).send({
      message: error instanceof Error ? error.message : "注册失败"
    });
  }
});

app.post("/api/auth/login", async (request, reply) => {
  const payload = loginInputSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "登录参数不合法",
      issues: payload.error.flatten()
    });
  }

  try {
    const result = await loginUser(app, payload.data.email, payload.data.password);
    return reply.send(result);
  } catch {
    return reply.code(401).send({
      message: "邮箱或密码错误"
    });
  }
});

app.get("/api/auth/me", { preHandler: [authenticate] }, async (request) => {
  return { user: request.user };
});

// ── Health / catalog (public) ──

app.get("/health", async () => ({
  status: "ok",
  service: "meeting-flow-api"
}));

app.get("/api/product", async () => ({
  product: meetingFlowProduct
}));

app.get("/api/catalog/nodes", async () => ({
  items: meetingNodeCatalog
}));

app.get("/api/workflows/default", async () => ({
  workflow: defaultWorkflowBlueprint
}));

app.get("/api/integrations/google/status", { preHandler: [authenticate] }, async (request) => {
  const config = getGoogleConfig();
  const account = await getIntegrationAccount(request.user.id, "google");
  const isConnected = Boolean(account);

  return {
    provider: "google",
    isConfigured: config.isConfigured,
    isConnected,
    redirectUri: config.redirectUri,
    message: !config.isConfigured
      ? "请配置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 GOOGLE_REDIRECT_URI"
      : isConnected
        ? "Google Calendar 已连接，可以同步会议"
        : "Google Calendar 已配置，请连接 Google 完成用户授权"
  };
});

app.get("/api/integrations/google/auth-url", { preHandler: [authenticate] }, async (request, reply) => {
  const config = getGoogleConfig();

  if (!config.isConfigured) {
    return reply.code(400).send({
      message: "请先配置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 GOOGLE_REDIRECT_URI",
      redirectUri: config.redirectUri
    });
  }

  const token = await reply.jwtSign(
    { sub: request.user.id, email: request.user.email, role: request.user.role },
    { expiresIn: "10m" }
  );

  return {
    authUrl: buildGoogleAuthUrl(token),
    redirectUri: config.redirectUri
  };
});

app.get("/api/integrations/feishu/status", { preHandler: [authenticate] }, async (request) => {
  const config = getFeishuConfig();
  const account = await getIntegrationAccount(request.user.id, "feishu");
  const missingScopes = account ? getMissingFeishuCalendarScopes(account) : [];
  const isConnected = Boolean(account && missingScopes.length === 0);

  return {
    provider: "feishu",
    isConfigured: config.isConfigured,
    isConnected,
    redirectUri: config.redirectUri,
    calendarId: config.calendarId,
    missingScopes,
    message: !config.isConfigured
      ? "请配置 FEISHU_APP_ID、FEISHU_APP_SECRET 和 FEISHU_REDIRECT_URI"
      : isConnected
        ? "飞书日历已连接，可以同步会议"
        : account
          ? `当前飞书授权缺少日历权限，请重新连接飞书：${missingScopes.join(", ")}`
          : "飞书日历已配置，请连接飞书完成用户授权"
  };
});

app.get("/api/integrations/feishu/auth-url", { preHandler: [authenticate] }, async (request, reply) => {
  const config = getFeishuConfig();

  if (!config.isConfigured) {
    return reply.code(400).send({
      message: "请先配置 FEISHU_APP_ID、FEISHU_APP_SECRET 和 FEISHU_REDIRECT_URI",
      redirectUri: config.redirectUri
    });
  }

  const token = await reply.jwtSign(
    { sub: request.user.id, email: request.user.email, role: request.user.role },
    { expiresIn: "10m" }
  );

  return {
    authUrl: buildFeishuAuthUrl(token),
    redirectUri: config.redirectUri
  };
});

app.get("/api/integrations/feishu/callback", async (request, reply) => {
  const query = request.query as { code?: string; state?: string; error?: string; error_description?: string };

  if (query.error) {
    return reply.type("text/html; charset=utf-8").send(`<p>飞书授权失败：${query.error_description ?? query.error}</p>`);
  }

  if (!query.code || !query.state) {
    return reply.code(400).type("text/html; charset=utf-8").send("<p>飞书授权回调缺少 code 或 state。</p>");
  }

  try {
    const decoded = app.jwt.verify<{ sub: string }>(query.state);
    await exchangeFeishuCode(decoded.sub, query.code);

    return reply.type("text/html; charset=utf-8").send(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>飞书日历已连接</title>
        </head>
        <body>
          <main style="font-family: system-ui, sans-serif; padding: 32px;">
            <h1>飞书日历已连接</h1>
            <p>现在可以回到 Meeting Flow Studio，把会议同步到飞书日历。</p>
            <script>setTimeout(() => window.close(), 1200);</script>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    return reply.code(400).type("text/html; charset=utf-8").send(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>飞书日历连接失败</title>
        </head>
        <body>
          <main style="font-family: system-ui, sans-serif; padding: 32px;">
            <h1>飞书日历连接失败</h1>
            <p>${error instanceof Error ? error.message : "授权失败，请重试。"}</p>
          </main>
        </body>
      </html>
    `);
  }
});

app.get("/api/integrations/google/callback", async (request, reply) => {
  const query = request.query as { code?: string; state?: string; error?: string };

  if (query.error) {
    return reply.type("text/html; charset=utf-8").send(`<p>Google 授权失败：${query.error}</p>`);
  }

  if (!query.code || !query.state) {
    return reply.code(400).type("text/html; charset=utf-8").send("<p>Google 授权回调缺少 code 或 state。</p>");
  }

  try {
    const decoded = app.jwt.verify<{ sub: string }>(query.state);
    await exchangeGoogleCode(decoded.sub, query.code);

    return reply.type("text/html; charset=utf-8").send(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>Google Calendar 已连接</title>
        </head>
        <body>
          <main style="font-family: system-ui, sans-serif; padding: 32px;">
            <h1>Google Calendar 已连接</h1>
            <p>现在可以回到 Meeting Flow Studio，把会议同步到 Google 日历并生成 Google Meet 链接。</p>
            <script>setTimeout(() => window.close(), 1200);</script>
          </main>
        </body>
      </html>
    `);
  } catch (error) {
    return reply.code(400).type("text/html; charset=utf-8").send(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>Google Calendar 连接失败</title>
        </head>
        <body>
          <main style="font-family: system-ui, sans-serif; padding: 32px;">
            <h1>Google Calendar 连接失败</h1>
            <p>${error instanceof Error ? error.message : "授权失败，请重试。"}</p>
          </main>
        </body>
      </html>
    `);
  }
});

app.get("/api/workflows/templates", { preHandler: [authenticate] }, async () => ({
  items: workflowTemplates
}));

app.get("/api/workflows/templates/:id", { preHandler: [authenticate] }, async (request, reply) => {
  const template = workflowTemplates.find((item) => item.id === (request.params as { id: string }).id);

  if (!template) {
    return reply.code(404).send({
      message: "未找到对应工作流模板"
    });
  }

  return {
    template
  };
});

app.patch("/api/workflows/templates/:id/canvas", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const body = request.body as Partial<ProductWorkflowTemplate>;
  const template = workflowTemplates.find((item) => item.id === id);

  if (!template) {
    return reply.code(404).send({
      message: "未找到对应工作流模板"
    });
  }

  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return reply.code(400).send({
      message: "请提供有效的节点和连线"
    });
  }

  const nodeIds = new Set(body.nodes.map((node) => node.id));
  const hasInvalidEdge = body.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target));

  if (hasInvalidEdge) {
    return reply.code(400).send({
      message: "连线必须连接到现有节点"
    });
  }

  const updatedTemplate: ProductWorkflowTemplate = {
    ...template,
    nodes: body.nodes,
    edges: body.edges,
    updatedAt: new Date().toISOString()
  };

  workflowTemplates = workflowTemplates.map((item) => (item.id === id ? updatedTemplate : item));
  await saveWorkflowTemplates(workflowTemplates);

  return {
    template: updatedTemplate,
    message: "画布已保存"
  };
});

app.patch("/api/workflows/templates/:templateId/nodes/:nodeId/config", { preHandler: [authenticate] }, async (request, reply) => {
  const { templateId, nodeId } = request.params as { templateId: string; nodeId: string };
  const body = request.body as { fields?: Array<{ key: string; value: string }> };
  const template = workflowTemplates.find((item) => item.id === templateId);

  if (!template) {
    return reply.code(404).send({
      message: "未找到对应工作流模板"
    });
  }

  const node = template.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return reply.code(404).send({
      message: "未找到对应节点"
    });
  }

  const fields = Array.isArray(body.fields) ? body.fields : [];
  const valueByKey = new Map(fields.map((field) => [field.key, String(field.value ?? "")]));
  const updatedAt = new Date().toISOString();
  const updatedTemplate: ProductWorkflowTemplate = {
    ...template,
    updatedAt,
    nodes: template.nodes.map((item) =>
      item.id === nodeId
        ? {
            ...item,
            configFields: item.configFields.map((field) =>
              valueByKey.has(field.key) ? { ...field, value: valueByKey.get(field.key) ?? "" } : field
            )
          }
        : item
    )
  };

  workflowTemplates = workflowTemplates.map((item) => (item.id === templateId ? updatedTemplate : item));
  await saveWorkflowTemplates(workflowTemplates);

  return {
    template: updatedTemplate,
    message: "节点配置已保存"
  };
});

app.get("/api/workflows/runs", { preHandler: [authenticate] }, async (request) => {
  const query = request.query as { templateId?: string; meetingId?: string };
  const items = workflowRuns.filter((run) => {
    const matchesTemplate = query.templateId ? run.templateId === query.templateId : true;
    const matchesMeeting = query.meetingId ? run.meetingId === query.meetingId : true;

    return matchesTemplate && matchesMeeting;
  });

  return {
    items
  };
});

app.get("/api/workflows/runs/:id", { preHandler: [authenticate] }, async (request, reply) => {
  const run = workflowRuns.find((item) => item.id === (request.params as { id: string }).id);

  if (!run) {
    return reply.code(404).send({
      message: "未找到对应运行记录"
    });
  }

  return {
    run
  };
});

app.post("/api/workflows/runs", { preHandler: [authenticate] }, async (request, reply) => {
  const body = request.body as { meetingId?: string; templateId?: string };
  const meeting = body.meetingId ? findMeeting(body.meetingId) : null;

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议，无法启动流程"
    });
  }

  const template = selectWorkflowTemplate(meeting, body.templateId);
  if (!template) {
    return reply.code(404).send({
      message: "未找到可用工作流模板"
    });
  }

  const run = await createWorkflowRun(meeting, template);
  workflowRuns = [run, ...workflowRuns].sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(workflowRuns);

  return reply.code(201).send({
    run,
    message: run.status === "blocked" ? "流程已启动，但需要人工处理阻塞节点" : "流程已启动并完成运行"
  });
});

app.patch("/api/workflows/runs/:id/advance", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const body = request.body as { resolutionNote?: string };
  const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
  const run = workflowRuns.find((item) => item.id === id);

  if (!run) {
    return reply.code(404).send({
      message: "未找到对应运行记录"
    });
  }

  if (!resolutionNote) {
    return reply.code(400).send({
      message: "请填写阻塞处理说明"
    });
  }

  if (!run.nodeRuns.some((nodeRun) => nodeRun.status === "blocked")) {
    return reply.code(400).send({
      message: "当前运行没有阻塞节点需要处理"
    });
  }

  const meeting = findMeeting(run.meetingId);
  const template = workflowTemplates.find((t) => t.id === run.templateId);

  if (!meeting || !template) {
    return reply.code(404).send({
      message: "关联的会议或模板已不存在"
    });
  }

  const advancedRun = await advanceWorkflowExecution(run, meeting, template, resolutionNote);
  workflowRuns = workflowRuns.map((item) => (item.id === id ? advancedRun : item)).sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(workflowRuns);

  return {
    run: advancedRun,
    message: "阻塞节点已处理，流程已继续运行"
  };
});

// ── Workflow: Retry & Cancel ──

app.post("/api/workflows/runs/:id/retry", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const originalRun = workflowRuns.find((r) => r.id === id);

  if (!originalRun) {
    return reply.code(404).send({ message: "未找到对应运行记录" });
  }

  if (originalRun.status !== "failed") {
    return reply.code(400).send({ message: "只有失败的运行可以重试" });
  }

  const meeting = findMeeting(originalRun.meetingId);
  const template = workflowTemplates.find((t) => t.id === originalRun.templateId);

  if (!meeting || !template) {
    return reply.code(404).send({ message: "关联的会议或模板已不存在" });
  }

  const newRun = await createWorkflowRun(meeting, template);
  workflowRuns = [newRun, ...workflowRuns].sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(workflowRuns);

  return reply.code(201).send({
    run: newRun,
    message: "流程已重新启动"
  });
});

app.post("/api/workflows/runs/:id/cancel", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const run = workflowRuns.find((r) => r.id === id);

  if (!run) {
    return reply.code(404).send({ message: "未找到对应运行记录" });
  }

  if (run.status === "completed" || run.status === "failed") {
    return reply.code(400).send({ message: "该运行已结束，无法取消" });
  }

  const cancelledRun: ProductWorkflowRun = {
    ...run,
    status: "failed",
    endedAt: new Date().toISOString(),
    logs: [
      ...run.logs,
      {
        id: `log-${Date.now()}-cancel`,
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        level: "warning",
        message: "流程已被用户取消"
      }
    ]
  };

  workflowRuns = workflowRuns.map((r) => (r.id === id ? cancelledRun : r));
  await saveWorkflowRuns(workflowRuns);

  return { run: cancelledRun, message: "流程已取消" };
});

// ── Schedule management ──

app.get("/api/workflows/schedules", { preHandler: [authenticate] }, async () => ({
  items: getAllSchedules()
}));

app.post("/api/workflows/schedules", { preHandler: [authenticate] }, async (request, reply) => {
  const body = request.body as { templateId?: string; cronExpression?: string };
  const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
  const cronExpression = typeof body.cronExpression === "string" ? body.cronExpression.trim() : "";

  if (!templateId) {
    return reply.code(400).send({ message: "请选择工作流模板" });
  }

  if (!cronExpression) {
    return reply.code(400).send({ message: "请填写 Cron 表达式" });
  }

  const template = workflowTemplates.find((t) => t.id === templateId);
  if (!template) {
    return reply.code(404).send({ message: "未找到对应模板" });
  }

  const schedule = addSchedule({
    id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    templateId,
    cronExpression,
    enabled: true
  });

  return reply.code(201).send({ schedule, message: "计划任务已创建" });
});

app.delete("/api/workflows/schedules/:id", { preHandler: [authenticate] }, async (request, _reply) => {
  const id = (request.params as { id: string }).id;
  removeSchedule(id);
  return { deletedId: id, message: "计划任务已删除" };
});

app.get("/api/meetings", { preHandler: [authenticate] }, async (request) => {
  const status = normalizeStatus((request.query as { status?: string }).status);
  const filtered = status === "all" ? meetings : meetings.filter((meeting) => meeting.status === status);

  return {
    items: attachPermissionsToItems(filtered, request.user),
    summary: buildMeetingSummary(meetings)
  };
});

app.get("/api/meetings/:id", { preHandler: [authenticate] }, async (request, reply) => {
  const meeting = findMeeting((request.params as { id: string }).id);

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议"
    });
  }

  return {
    meeting: attachPermissions(meeting, request.user)
  };
});

app.post("/api/meetings", { preHandler: [authenticate] }, async (request, reply) => {
  const payload = createMeetingSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "会议创建参数不合法",
      issues: payload.error.flatten()
    });
  }

  const validationMessage = validateMeetingInput(payload.data);
  if (validationMessage) {
    return reply.code(400).send({
      message: validationMessage
    });
  }

  const meeting = createMeetingRecord(payload.data, request.user?.id);
  meetings = [meeting, ...meetings].sort(sortByUpdatedAtDesc);
  await saveMeetings(meetings);

  return reply.code(201).send({
    meeting: attachPermissions(meeting, request.user),
    summary: buildMeetingSummary(meetings),
    message: payload.data.submissionMode === "save" ? "会议已保存为草稿" : "会议已提交申请"
  });
});

app.put("/api/meetings/:id", { preHandler: [authenticate] }, async (request, reply) => {
  const payload = updateMeetingSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "会议更新参数不合法",
      issues: payload.error.flatten()
    });
  }

  const validationMessage = validateMeetingInput(payload.data);
  if (validationMessage) {
    return reply.code(400).send({
      message: validationMessage
    });
  }

  const id = (request.params as { id: string }).id;
  const meeting = findMeeting(id);

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议"
    });
  }

  const updatedMeeting = updateMeetingRecord(meeting, payload.data);
  meetings = meetings.map((item) => (item.id === id ? updatedMeeting : item)).sort(sortByUpdatedAtDesc);
  await saveMeetings(meetings);

  return {
    meeting: attachPermissions(updatedMeeting, request.user),
    summary: buildMeetingSummary(meetings),
    message: "会议信息已更新"
  };
});

app.patch("/api/meetings/:id/status", { preHandler: [authenticate] }, async (request, reply) => {
  const payload = updateMeetingStatusSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "会议状态参数不合法",
      issues: payload.error.flatten()
    });
  }

  const id = (request.params as { id: string }).id;
  const meeting = findMeeting(id);

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议"
    });
  }

  const updatedMeeting: MeetingRecord = {
    ...meeting,
    status: payload.data.status,
    updatedAt: new Date().toISOString(),
    submittedAt:
      payload.data.status === "draft"
        ? meeting.submittedAt
        : meeting.submittedAt || new Date().toISOString()
  };

  meetings = meetings.map((item) => (item.id === id ? updatedMeeting : item)).sort(sortByUpdatedAtDesc);
  await saveMeetings(meetings);

  return {
    meeting: attachPermissions(updatedMeeting, request.user),
    summary: buildMeetingSummary(meetings),
    message: `会议状态已更新为${meetingStatusLabels[payload.data.status]}`
  };
});

app.delete("/api/meetings/:id", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const meeting = findMeeting(id);

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议"
    });
  }

  meetings = meetings.filter((item) => item.id !== id);
  await saveMeetings(meetings);

  return {
    deletedId: id,
    summary: buildMeetingSummary(meetings),
    message: "会议已删除"
  };
});

app.post("/api/meetings/:id/sync-google-calendar", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const meeting = findMeeting(id);

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议"
    });
  }

  try {
    const externalCalendar = await syncGoogleCalendarEvent(request.user.id, meeting);
    const updatedMeeting: MeetingRecord = {
      ...meeting,
      externalCalendar,
      meetingLink: externalCalendar.hangoutLink || meeting.meetingLink,
      updatedAt: new Date().toISOString()
    };

    meetings = meetings.map((item) => (item.id === id ? updatedMeeting : item)).sort(sortByUpdatedAtDesc);
    await saveMeetings(meetings);

    return {
      meeting: attachPermissions(updatedMeeting, request.user),
      summary: buildMeetingSummary(meetings),
      message: externalCalendar.provider === "mock"
        ? "已生成模拟日历事件，会议流程可以先跑通"
        : externalCalendar.hangoutLink
          ? "已同步到 Google Calendar，并生成 Google Meet 链接"
          : "已同步到 Google Calendar"
    };
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof Error ? error.message : "Google Calendar 同步失败"
    });
  }
});

app.post("/api/meetings/:id/sync-feishu-calendar", { preHandler: [authenticate] }, async (request, reply) => {
  const id = (request.params as { id: string }).id;
  const meeting = findMeeting(id);

  if (!meeting) {
    return reply.code(404).send({
      message: "未找到对应会议"
    });
  }

  try {
    const externalCalendar = await syncFeishuCalendarEvent(request.user.id, meeting);
    const updatedMeeting: MeetingRecord = {
      ...meeting,
      externalCalendar,
      updatedAt: new Date().toISOString()
    };

    meetings = meetings.map((item) => (item.id === id ? updatedMeeting : item)).sort(sortByUpdatedAtDesc);
    await saveMeetings(meetings);

    return {
      meeting: attachPermissions(updatedMeeting, request.user),
      summary: buildMeetingSummary(meetings),
      message: externalCalendar.provider === "mock"
        ? "已生成飞书模拟日程，会议流程可以先跑通"
        : "已同步到飞书日历"
    };
  } catch (error) {
    return reply.code(400).send({
      message: error instanceof Error ? error.message : "飞书日历同步失败"
    });
  }
});

app.post("/api/meetings/intake", { preHandler: [authenticate] }, async (request, reply) => {
  const payload = meetingIntakeSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "会议申请参数不合法",
      issues: payload.error.flatten()
    });
  }

  const { title, participants, meetingGoal, channel } = payload.data;

  return {
    workflowId: defaultWorkflowBlueprint.id,
    meeting: {
      title,
      attendeeCount: participants.length,
      channel
    },
    recommendations: [
      "建议先生成包含时间分配的精简议程。",
      "建议提前确认主持人、记录人和关键决策人是否到位。",
      "建议会后自动生成待办并同步给责任人。"
    ],
    confidence: participants.length > 12 ? "需要复核" : "自动通过",
    summary: `会议申请已受理：${title}。会议目标：${meetingGoal}`
  };
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

startScheduler(workflowTemplates, meetings, async (templateId: string) => {
  const template = workflowTemplates.find((t) => t.id === templateId);
  if (!template) return;

  // Use the most recent matching meeting or create a mock context
  const matchingMeeting = meetings.find((m) => m.type === template.category) ?? meetings[0];
  if (!matchingMeeting) return;

  try {
    const run = await createWorkflowRun(matchingMeeting, template);
    workflowRuns = [run, ...workflowRuns].sort(sortRunsByStartedAtDesc);
    await saveWorkflowRuns(workflowRuns);
    app.log.info(`Scheduled workflow "${template.name}" executed: ${run.id}`);
  } catch (error) {
    app.log.error(`Scheduled workflow failed: ${String(error)}`);
  }
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

import Fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import type { MeetingRecord, MeetingMemory, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { ensureProductWorkflowNodeExecutors } from "@meeting-flow/shared";
import { loadMeetings } from "./meetingStore.js";
import { loadMeetingMemories } from "./memoryStore.js";
import { syncVectorKnowledgeIndex } from "./vectorStore.js";
import { listKnowledgeDocuments } from "./knowledgeDocumentStore.js";
import { loadWorkflowRuns, loadWorkflowTemplates } from "./workflowStore.js";
import { loadUsers, migrateExistingMeetings } from "./userStore.js";
import { enqueueWorkflowRunJob } from "./services/workflowJobRunner.js";
import { recordScheduleExecution } from "./services/scheduler.js";
import { buildWorkflowExecutionOptions } from "./lib/executionOptions.js";
import { assertProductionSecrets, getJwtSecret, isSchedulerEnabled } from "./lib/env.js";
import { assertDatabaseConfig, ensureDatabaseReady } from "./lib/db/index.js";
import { startScheduler } from "./services/scheduler.js";

// Route modules
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { meetingRoutes } from "./routes/meetings.js";
import { workflowRoutes } from "./routes/workflows.js";
import { appRoutes } from "./routes/apps.js";
import { aiRoutes } from "./routes/ai.js";
import { integrationRoutes } from "./routes/integrations.js";
import { agentRoutes } from "./routes/agent.js";
import { serviceApiRoutes } from "./routes/serviceApi.js";
import { memoryRoutes } from "./routes/memories.js";
import { knowledgeRoutes } from "./routes/knowledge.js";

// ── Create server ──

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  },
});

// ── Unified error handler ──

app.setErrorHandler((error: FastifyError, _request, reply) => {
  const statusCode = error.statusCode ?? (error.validation ? 400 : 500);
  const message = error.statusCode === 429
    ? "请求过于频繁，请稍后重试"
    : error.statusCode && error.statusCode < 500
      ? error.message
      : "服务器内部错误";

  app.log.error({ err: error, statusCode }, message);

  return reply.code(statusCode).send({
    message,
    ...(process.env.NODE_ENV === "development" && statusCode >= 500 ? { detail: error.message } : {}),
  });
});

// ── Rate limiting ──

const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 200; // requests per window
const RATE_LIMIT_AUTH_MAX = 10; // auth requests per window

function getRateLimitKey(ip: string, route: string) {
  return `${ip}::${route}`;
}

app.addHook("onRequest", async (request, reply) => {
  const ip = request.ip || "unknown";
  const url = request.url;
  const isAuthRoute = url.startsWith("/api/auth/");

  // Skip rate limiting for health check and static
  if (url === "/health") return;

  const key = getRateLimitKey(ip, isAuthRoute ? "auth" : "general");
  const now = Date.now();
  let entry = rateLimitCounters.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitCounters.set(key, entry);
  }

  const maxRequests = isAuthRoute ? RATE_LIMIT_AUTH_MAX : RATE_LIMIT_MAX;
  entry.count++;

  reply.header("X-RateLimit-Limit", maxRequests);
  reply.header("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
  reply.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

  if (entry.count > maxRequests) {
    return reply.code(429).send({ message: "请求过于频繁，请稍后重试" });
  }
});

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitCounters) {
    if (now > entry.resetAt) rateLimitCounters.delete(key);
  }
}, 120_000);

// ── Plugins ──

await app.register(cors, { origin: true });

const jwtSecret = getJwtSecret();
await app.register(fjwt, { secret: jwtSecret });

// Register WebSocket plugin
await app.register(websocket);

// ── Shared context ──

assertDatabaseConfig();
await ensureDatabaseReady();

const meetings: MeetingRecord[] = await loadMeetings();
const meetingMemories: MeetingMemory[] = await loadMeetingMemories();
const workflowRuns: ProductWorkflowRun[] = await loadWorkflowRuns();
const workflowTemplates: ProductWorkflowTemplate[] = (await loadWorkflowTemplates()).map(ensureProductWorkflowNodeExecutors);

await loadUsers();
await migrateExistingMeetings();
await syncVectorKnowledgeIndex(meetingMemories, meetings, await listKnowledgeDocuments());

const wsClients = new Set<WebSocket>();

function broadcastWorkflowUpdate(run: ProductWorkflowRun) {
  const message = JSON.stringify({ type: "workflow:update", payload: run });
  for (const client of wsClients) {
    try { client.send(message); } catch { wsClients.delete(client); }
  }
}

const ctx = { meetings, meetingMemories, workflowRuns, workflowTemplates, broadcastWorkflowUpdate };

// ── WebSocket for workflow run status ──

app.register(async (wsApp) => {
  wsApp.get("/api/ws/workflows", { websocket: true }, (socket: import("@fastify/websocket").WebSocket) => {
    wsClients.add(socket);

    socket.on("close", () => {
      wsClients.delete(socket);
    });

    socket.send(JSON.stringify({
      type: "connected",
      payload: { message: "已连接到工作流状态推送" },
    }));
  });
});

declare module "fastify" {
  interface FastifyInstance {
    appCtx: typeof ctx;
    broadcastWorkflowUpdate: typeof broadcastWorkflowUpdate;
  }
}
app.decorate("appCtx", ctx);
app.decorate("broadcastWorkflowUpdate", broadcastWorkflowUpdate);

// ── Register routes ──

await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(async (subApp) => meetingRoutes(subApp, ctx));
await app.register(async (subApp) => workflowRoutes(subApp, ctx));
await app.register(async (subApp) => appRoutes(subApp, ctx));
await app.register(async (subApp) => agentRoutes(subApp, ctx));
await app.register(async (subApp) => serviceApiRoutes(subApp, ctx));
await app.register(async (subApp) => memoryRoutes(subApp, ctx));
await app.register(async (subApp) => knowledgeRoutes(subApp, ctx));
await app.register(aiRoutes);
await app.register(integrationRoutes);

// ── Start ──

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

assertProductionSecrets();

if (isSchedulerEnabled()) {
  await startScheduler(ctx.workflowTemplates, ctx.meetings, async (schedule) => {
  const template = ctx.workflowTemplates.find((t) => t.id === schedule.templateId);
  if (!template) return;

  const matchingMeeting =
    (schedule.meetingId ? ctx.meetings.find((m) => m.id === schedule.meetingId) : null) ??
    ctx.meetings.find((m) => m.type === template.category) ??
    ctx.meetings[0];
  if (!matchingMeeting) return;

  try {
    const executionOptions = await buildWorkflowExecutionOptions(matchingMeeting.ownerUserId || "system");
    const run = await enqueueWorkflowRunJob(ctx, matchingMeeting, template, executionOptions);
    await recordScheduleExecution(schedule.id, run.id, run.status);
    app.log.info(`Scheduled workflow "${template.name}" started: ${run.id}`);
  } catch (error) {
    app.log.error(`Scheduled workflow failed: ${String(error)}`);
  }
  });
} else {
  app.log.warn("Scheduler disabled via SCHEDULER_ENABLED=false");
}

try {
  await app.listen({ port, host });
  app.log.info(`Meeting Flow API running at http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

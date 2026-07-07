import Fastify from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import type { MeetingRecord, MeetingMemory, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { ensureProductWorkflowNodeExecutors } from "@meeting-flow/shared";
import { healthRoutes } from "../routes/health.js";
import { authRoutes } from "../routes/auth.js";
import { meetingRoutes } from "../routes/meetings.js";
import { workflowRoutes } from "../routes/workflows.js";
import { appRoutes } from "../routes/apps.js";
import { agentRoutes } from "../routes/agent.js";
import { memoryRoutes } from "../routes/memories.js";
import { knowledgeRoutes } from "../routes/knowledge.js";
import { aiRoutes } from "../routes/ai.js";
import { integrationRoutes } from "../routes/integrations.js";

export interface TestContext {
  meetings: MeetingRecord[];
  meetingMemories: MeetingMemory[];
  workflowRuns: ProductWorkflowRun[];
  workflowTemplates: ProductWorkflowTemplate[];
}

const defaultTemplates: ProductWorkflowTemplate[] = [
  {
    id: "template-test-001",
    name: "测试会议流程",
    category: "weekly",
    description: "用于测试的基础工作流模板",
    status: "published",
    nodes: [
      {
        id: "node-trigger",
        title: "触发节点",
        kind: "trigger",
        description: "工作流起点",
        position: { x: 100, y: 100 },
        owner: "system",
        configFields: [],
        inputs: [],
        outputs: ["event"],
        executor: { type: "system", label: "系统执行器", runtime: "system", inputMapping: {}, outputMapping: {} },
      },
      {
        id: "node-ai",
        title: "AI 节点",
        kind: "ai",
        description: "AI 执行节点",
        position: { x: 300, y: 100 },
        owner: "system",
        configFields: [],
        inputs: ["event"],
        outputs: ["result"],
        executor: {
          type: "aiApplication",
          applicationId: "app-test-ai",
          label: "AI 节点智能体",
          runtime: "agent",
          inputMapping: {},
          outputMapping: {},
        },
        agentInputSchema: [{ key: "prompt", label: "Prompt", type: "text", required: true, description: "", defaultValue: "" }],
        agentOutputSchema: [{ key: "result", label: "Result", type: "text", description: "" }],
        agentPromptConfig: {
          systemPrompt: "You are a helpful assistant.",
          userPrompt: "{{input.prompt}}",
          model: "claude-sonnet-4-20250514",
          temperature: 0.5,
          maxTokens: 1024,
        },
        agentVersions: [],
      },
      {
        id: "node-decision",
        title: "决策节点",
        kind: "decision",
        description: "条件判断",
        position: { x: 500, y: 100 },
        owner: "system",
        configFields: [{ key: "condition", label: "条件表达式", value: "result === 'ok'", kind: "text" }],
        inputs: ["result"],
        outputs: ["yes", "no"],
        executor: { type: "system", label: "系统执行器", runtime: "system", inputMapping: {}, outputMapping: {} },
      },
    ],
    edges: [
      { id: "edge-1", source: "node-trigger", target: "node-ai", label: "" },
      { id: "edge-2", source: "node-ai", target: "node-decision", label: "" },
    ],
    updatedAt: new Date().toISOString(),
  },
];

export async function buildTestApp(ctx?: Partial<TestContext>) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(fjwt, { secret: "test-secret-key-for-integration-tests" });

  const meetings: MeetingRecord[] = ctx?.meetings ?? [];
  const meetingMemories: MeetingMemory[] = ctx?.meetingMemories ?? [];
  const workflowRuns: ProductWorkflowRun[] = ctx?.workflowRuns ?? [];
  const workflowTemplates: ProductWorkflowTemplate[] = (ctx?.workflowTemplates ?? defaultTemplates).map(ensureProductWorkflowNodeExecutors);

  const appCtx = { meetings, meetingMemories, workflowRuns, workflowTemplates };

  // Register all routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(async (subApp) => meetingRoutes(subApp, appCtx));
  await app.register(async (subApp) => workflowRoutes(subApp, appCtx));
  await app.register(async (subApp) => appRoutes(subApp, appCtx));
  await app.register(async (subApp) => agentRoutes(subApp, appCtx));
  await app.register(async (subApp) => memoryRoutes(subApp, appCtx));
  await app.register(async (subApp) => knowledgeRoutes(subApp, appCtx));
  await app.register(aiRoutes);
  await app.register(integrationRoutes);

  await app.ready();
  return app;
}

let registrationCounter = 0;

/** Helper: register a user and return the auth token. Uses unique email to avoid conflicts. */
export async function registerAndGetToken(app: ReturnType<typeof Fastify>, email?: string, password = "Test123456", name = "测试用户") {
  const uniqueEmail = email ?? `test-${Date.now()}-${++registrationCounter}@test.com`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: uniqueEmail, password, name },
  });
  const body = JSON.parse(res.body);
  if (res.statusCode !== 201) {
    throw new Error(`Registration failed (${res.statusCode}): ${JSON.stringify(body)}`);
  }
  return { token: body.token, user: body.user };
}

/** Helper: create a meeting via API */
export async function createTestMeeting(app: ReturnType<typeof Fastify>, token: string, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const startAt = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now
  const endAt = new Date(now.getTime() + 7200000).toISOString();   // 2 hours from now

  const payload = {
    title: "测试会议",
    type: "weekly",
    priority: "medium",
    channel: "zoom",
    host: "张三",
    owner: "张三",
    description: "集成测试会议",
    meetingGoal: "验证 API 功能",
    location: "会议室 A",
    meetingLink: "",
    startAt,
    endAt,
    isRecurring: false,
    recurrence: "",
    participants: [{ name: "张三", role: "host", status: "accepted" }],
    agendaItems: [{ title: "议程一", completed: false }],
    tags: ["test"],
    submissionMode: "submit" as const,
    ...overrides,
  };

  const res = await app.inject({
    method: "POST",
    url: "/api/meetings",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });

  const body = JSON.parse(res.body);
  return { meeting: body.meeting, summary: body.summary, statusCode: res.statusCode };
}

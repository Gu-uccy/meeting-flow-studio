import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContext } from "../lib/context.js";
import { canAccessMemory, selectWorkflowTemplate, createWorkflowRun, persistWorkflowMemories, persistWorkflowMeetingWriteback, notifyWorkflowUpdate } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { buildPermissions } from "../services/auth.js";
import { planMeetingAgentWorkflow, runMeetingAgent } from "../services/agent.js";
import { getUserAiApiKey } from "../aiKeyStore.js";
import { saveWorkflowRuns } from "../workflowStore.js";
import { sortRunsByStartedAtDesc } from "../lib/context.js";

export async function agentRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post("/api/agent/meetings/:id/run", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { templateId?: string } | null;
    const meeting = ctx.meetings.find((m) => m.id === id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议，无法运行 Agent" });

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canEdit) return reply.code(403).send({ message: "当前账号无权运行该会议的工作流 Agent" });

    const accessibleMemories = ctx.meetingMemories.filter((m) => canAccessMemory(m, request.user, ctx));
    const relatedRuns = ctx.workflowRuns.filter((r) => r.meetingId === meeting.id);
    const modelApiKey = await getUserAiApiKey(request.user.id);

    const agentPlan = body?.templateId
      ? { templateId: body.templateId, rationale: "用户指定模板，Agent 跳过 AI 模板选择。", model: "user-selected", degraded: true }
      : await planMeetingAgentWorkflow({ meeting, templates: ctx.workflowTemplates, runs: relatedRuns, memories: accessibleMemories, modelApiKey });

    const template = ctx.workflowTemplates.find((t) => t.id === agentPlan.templateId) ?? selectWorkflowTemplate(meeting, ctx.workflowTemplates);
    if (!template) return reply.code(404).send({ message: "未找到可运行的工作流模板" });

    const workflowRun = await createWorkflowRun(meeting, template);
    ctx.workflowRuns = [workflowRun, ...ctx.workflowRuns].sort(sortRunsByStartedAtDesc);
    await saveWorkflowRuns(ctx.workflowRuns);
    await persistWorkflowMeetingWriteback(meeting, workflowRun, ctx);
    const memories = await persistWorkflowMemories(meeting, workflowRun, ctx);

    const agentRun = await runMeetingAgent({ meeting, plan: agentPlan, modelApiKey, selectedTemplate: template, executedRun: workflowRun, templates: ctx.workflowTemplates, runs: ctx.workflowRuns.filter((r) => r.meetingId === meeting.id), memories: accessibleMemories });

    notifyWorkflowUpdate(ctx, workflowRun);
    return { agentRun, workflowRun, memoryCount: memories.length, message: workflowRun.status === "blocked" ? "Agent 已运行工作流，但需要人工处理阻塞节点" : "Agent 已运行工作流" };
  });
}

import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAiApplicationsFromTemplates, ensureProductWorkflowNodeExecutors } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import type { AiApplicationVersion, ProductWorkflowTemplate } from "@meeting-flow/shared";
import {
  normalizeDebugInputs, validateApplicationInputs, getNodeApplicationBinding,
  buildNodeAgentVersion, createWorkflowRun, persistWorkflowMemories, persistWorkflowMeetingWriteback, notifyWorkflowUpdate,
} from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { buildPermissions } from "../services/auth.js";
import { saveWorkflowTemplates, saveWorkflowRuns } from "../workflowStore.js";
import { executeSingleNodeRun } from "../services/executor.js";
import { sortRunsByStartedAtDesc } from "../lib/context.js";
import { buildWorkflowExecutionOptions } from "../lib/executionOptions.js";
import { demotePublishedVersions } from "../services/nodeAgentRuntime.js";

export async function appRoutes(app: FastifyInstance, ctx: AppContext) {
  // List all AI applications
  app.get("/api/apps", { preHandler: [authenticate] }, async () => ({
    items: buildAiApplicationsFromTemplates(ctx.workflowTemplates),
  }));

  // Get single app
  app.get("/api/apps/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((a) => a.id === appId);
    if (!application) return reply.code(404).send({ message: "应用不存在" });
    const template = ctx.workflowTemplates.find((t) => t.id === application.templateId);
    return { application, template };
  });

  // App versions
  app.get("/api/apps/:id/versions", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const { application, node } = getNodeApplicationBinding(appId, ctx.workflowTemplates);
    if (!application || application.source !== "node" || !node) return reply.code(404).send({ message: "未找到可查看版本的节点智能体" });
    return { items: node.agentVersions ?? [] };
  });

  app.post("/api/apps/:id/versions", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const body = request.body as { status?: AiApplicationVersion["status"]; summary?: string };
    const { application, template, node } = getNodeApplicationBinding(appId, ctx.workflowTemplates);
    if (!application || application.source !== "node" || !template || !node) return reply.code(404).send({ message: "未找到可保存版本的节点智能体" });

    const status = body.status === "published" ? "published" : "snapshot";
    const summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.trim().slice(0, 160) : status === "published" ? "发布当前节点智能体配置" : "保存当前节点智能体配置快照";
    const version = buildNodeAgentVersion(application, template, node, status, summary, request.user.name);
    const updatedTemplate = ensureProductWorkflowNodeExecutors({
      ...template, status: status === "published" ? "published" : template.status, updatedAt: version.createdAt,
      nodes: template.nodes.map((n) => {
        if (n.id !== node.id) {
          return n;
        }

        const nextVersions = status === "published"
          ? demotePublishedVersions(n.agentVersions ?? [], version.id)
          : (n.agentVersions ?? []);

        return {
          ...n,
          agentVersions: [version, ...nextVersions].slice(0, 30)
        };
      }),
    });

    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === template.id ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    const updatedApp = buildAiApplicationsFromTemplates([updatedTemplate]).find((a) => a.id === appId);
    return reply.code(201).send({ application: updatedApp, template: updatedTemplate, version, message: status === "published" ? "节点智能体版本已发布" : "节点智能体版本已保存" });
  });

  app.post("/api/apps/:id/versions/:versionId/apply", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { id: appId, versionId } = request.params as { id: string; versionId: string };
    const { application, template, node } = getNodeApplicationBinding(appId, ctx.workflowTemplates);
    if (!application || application.source !== "node" || !template || !node) return reply.code(404).send({ message: "未找到可回滚的节点智能体" });

    const version = (node.agentVersions ?? []).find((v) => v.id === versionId);
    if (!version) return reply.code(404).send({ message: "未找到对应的节点智能体版本" });

    const updatedTemplate = ensureProductWorkflowNodeExecutors({
      ...template, updatedAt: new Date().toISOString(),
      nodes: template.nodes.map((n) => n.id === node.id ? { ...n, executor: version.executor, agentInputSchema: version.inputSchema, agentOutputSchema: version.outputSchema, agentPromptConfig: version.promptConfig } : n),
    });

    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === template.id ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    const updatedApp = buildAiApplicationsFromTemplates([updatedTemplate]).find((a) => a.id === appId);
    return { application: updatedApp, template: updatedTemplate, version, message: "节点智能体已回滚到选定版本" };
  });

  // App status
  app.patch("/api/apps/:id/status", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const body = request.body as { status?: ProductWorkflowTemplate["status"] };
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((a) => a.id === appId);
    if (!application) return reply.code(404).send({ message: "应用不存在" });
    if (body.status !== "draft" && body.status !== "published") return reply.code(400).send({ message: "应用状态无效" });

    const template = ctx.workflowTemplates.find((t) => t.id === application.templateId);
    if (!template) return reply.code(404).send({ message: "应用绑定的工作流模板不存在" });

    const updatedTemplate: ProductWorkflowTemplate = { ...template, status: body.status, updatedAt: new Date().toISOString() };
    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    const updatedApp = buildAiApplicationsFromTemplates([updatedTemplate]).find((a) => a.id === appId);
    return { application: updatedApp ?? buildAiApplicationsFromTemplates([updatedTemplate])[0], template: updatedTemplate, message: body.status === "published" ? "应用已发布" : "应用已下线为草稿" };
  });

  // App debug
  app.post("/api/apps/:id/debug", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const body = request.body as { meetingId?: string; inputs?: Record<string, unknown> };
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((a) => a.id === appId);
    if (!application) return reply.code(404).send({ message: "应用不存在" });

    const debugInputs = { ...normalizeDebugInputs(body.inputs), ...(body.meetingId ? { meetingId: body.meetingId } : {}) };
    const inputError = validateApplicationInputs(application, debugInputs);
    if (inputError) return reply.code(400).send({ message: inputError });

    const meetingId = String(debugInputs.meetingId ?? "");
    const meeting = meetingId ? ctx.meetings.find((m) => m.id === meetingId) : null;
    if (!meeting) return reply.code(404).send({ message: "请选择一场会议作为调试输入" });

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canEdit) return reply.code(403).send({ message: "当前账号无权调试这场会议" });

    const template = ctx.workflowTemplates.find((t) => t.id === application.templateId);
    if (!template) return reply.code(404).send({ message: "应用绑定的工作流模板不存在" });

    const node = application.source === "node" && application.nodeId ? template.nodes.find((n) => n.id === application.nodeId) : null;
    const executionOptions = await buildWorkflowExecutionOptions(request.user.id);
    const run = node
      ? await executeSingleNodeRun(meeting, template, node, debugInputs, executionOptions)
      : await createWorkflowRun(meeting, template, executionOptions, ctx);

    if (node) {
      ctx.workflowRuns = [run, ...ctx.workflowRuns].sort(sortRunsByStartedAtDesc);
      await saveWorkflowRuns(ctx.workflowRuns);
      await persistWorkflowMeetingWriteback(meeting, run, ctx);
      await persistWorkflowMemories(meeting, run, ctx);
      notifyWorkflowUpdate(ctx, run);
    }

    return reply.code(201).send({
      application,
      inputs: debugInputs,
      run,
      memoryCount: 0,
      message: run.status === "blocked" ? "调试运行已创建，流程停在阻塞节点" : "调试运行已完成"
    });
  });

  // App schema
  app.patch("/api/apps/:id/schema", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const body = request.body as { inputSchema?: ProductWorkflowTemplate["nodes"][number]["agentInputSchema"]; outputSchema?: ProductWorkflowTemplate["nodes"][number]["agentOutputSchema"] };
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((a) => a.id === appId);
    if (!application || application.source !== "node" || !application.nodeId) return reply.code(404).send({ message: "未找到可编辑的节点智能体" });

    const template = ctx.workflowTemplates.find((t) => t.id === application.templateId);
    const node = template?.nodes.find((n) => n.id === application.nodeId);
    if (!template || !node) return reply.code(404).send({ message: "节点智能体绑定的流程节点不存在" });

    const inputSchema = Array.isArray(body.inputSchema) ? body.inputSchema : node.agentInputSchema;
    const outputSchema = Array.isArray(body.outputSchema) ? body.outputSchema : node.agentOutputSchema;
    const updatedTemplate = ensureProductWorkflowNodeExecutors({
      ...template, updatedAt: new Date().toISOString(),
      nodes: template.nodes.map((n) => n.id === node.id ? { ...n, agentInputSchema: inputSchema, agentOutputSchema: outputSchema } : n),
    });

    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === template.id ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    const updatedApp = buildAiApplicationsFromTemplates([updatedTemplate]).find((a) => a.id === appId);
    return { application: updatedApp, template: updatedTemplate, message: "节点智能体 Schema 已保存" };
  });

  // App prompt
  app.patch("/api/apps/:id/prompt", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const appId = (request.params as { id: string }).id;
    const body = request.body as Partial<import("@meeting-flow/shared").AiApplicationPromptConfig>;
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((a) => a.id === appId);
    if (!application || application.source !== "node" || !application.nodeId) return reply.code(404).send({ message: "未找到可编辑的节点智能体" });

    const template = ctx.workflowTemplates.find((t) => t.id === application.templateId);
    const node = template?.nodes.find((n) => n.id === application.nodeId);
    if (!template || !node) return reply.code(404).send({ message: "节点智能体绑定的流程节点不存在" });

    const nextPromptConfig = {
      systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : application.promptConfig.systemPrompt,
      userPrompt: typeof body.userPrompt === "string" ? body.userPrompt : application.promptConfig.userPrompt,
      model: typeof body.model === "string" && body.model.trim() ? body.model : application.promptConfig.model,
      temperature: typeof body.temperature === "number" && body.temperature >= 0 && body.temperature <= 1 ? body.temperature : application.promptConfig.temperature,
      maxTokens: typeof body.maxTokens === "number" && body.maxTokens > 0 ? Math.min(Math.round(body.maxTokens), 8000) : application.promptConfig.maxTokens,
    };

    const updatedTemplate = ensureProductWorkflowNodeExecutors({
      ...template, updatedAt: new Date().toISOString(),
      nodes: template.nodes.map((n) => n.id === node.id ? { ...n, agentPromptConfig: nextPromptConfig } : n),
    });

    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === template.id ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    const updatedApp = buildAiApplicationsFromTemplates([updatedTemplate]).find((a) => a.id === appId);
    return { application: updatedApp, template: updatedTemplate, message: "节点智能体 Prompt 已保存" };
  });
}

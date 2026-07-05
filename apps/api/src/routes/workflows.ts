import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAiApplicationsFromTemplates, ensureProductWorkflowNodeExecutors, buildNodeAgentApplicationId } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import type { ProductWorkflowTemplate, ProductWorkflowNodeExecutor, ProductWorkflowRun } from "@meeting-flow/shared";
import { selectWorkflowTemplate, createWorkflowRun, persistWorkflowMemories, sortRunsByStartedAtDesc, notifyWorkflowUpdate } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { saveWorkflowTemplates, saveWorkflowRuns } from "../workflowStore.js";
import { advanceWorkflowExecution } from "../services/executor.js";
import { getAllSchedules, addSchedule, removeSchedule } from "../services/scheduler.js";

export async function workflowRoutes(app: FastifyInstance, ctx: AppContext) {
  // Templates
  app.get("/api/workflows/templates", { preHandler: [authenticate] }, async () => ({
    items: ctx.workflowTemplates.map(ensureProductWorkflowNodeExecutors),
  }));

  app.get("/api/workflows/templates/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const template = ctx.workflowTemplates.find((t) => t.id === (request.params as { id: string }).id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });
    return { template: ensureProductWorkflowNodeExecutors(template) };
  });

  app.patch("/api/workflows/templates/:id/canvas", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as Partial<ProductWorkflowTemplate>;
    const template = ctx.workflowTemplates.find((t) => t.id === id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) return reply.code(400).send({ message: "请提供有效的节点和连线" });

    const nodeIds = new Set(body.nodes.map((n) => n.id));
    const hasInvalidEdge = body.edges.some((e) => !nodeIds.has(e.source) || !nodeIds.has(e.target));
    if (hasInvalidEdge) return reply.code(400).send({ message: "连线必须连接到现有节点" });

    const updatedTemplate: ProductWorkflowTemplate = { ...template, nodes: body.nodes, edges: body.edges, updatedAt: new Date().toISOString() };
    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === id ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return { template: updatedTemplate, message: "画布已保存" };
  });

  app.patch("/api/workflows/templates/:templateId/nodes/:nodeId/config", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { templateId, nodeId } = request.params as { templateId: string; nodeId: string };
    const body = request.body as { fields?: Array<{ key: string; value: string }> };
    const template = ctx.workflowTemplates.find((t) => t.id === templateId);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });

    const node = template.nodes.find((n) => n.id === nodeId);
    if (!node) return reply.code(404).send({ message: "未找到对应节点" });

    const fields = Array.isArray(body.fields) ? body.fields : [];
    const valueByKey = new Map(fields.map((f) => [f.key, String(f.value ?? "")]));
    const updatedTemplate: ProductWorkflowTemplate = {
      ...template, updatedAt: new Date().toISOString(),
      nodes: template.nodes.map((n) => n.id === nodeId ? { ...n, configFields: n.configFields.map((f) => valueByKey.has(f.key) ? { ...f, value: valueByKey.get(f.key) ?? "" } : f) } : n),
    };

    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === templateId ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return { template: updatedTemplate, message: "节点配置已保存" };
  });

  app.patch("/api/workflows/templates/:templateId/nodes/:nodeId/executor", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { templateId, nodeId } = request.params as { templateId: string; nodeId: string };
    const body = request.body as { executor?: Partial<ProductWorkflowNodeExecutor> };
    const template = ctx.workflowTemplates.find((t) => t.id === templateId);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });

    const node = template.nodes.find((n) => n.id === nodeId);
    if (!node) return reply.code(404).send({ message: "未找到对应节点" });

    const nextType = body.executor?.type;
    if (nextType !== "aiApplication" && nextType !== "system" && nextType !== "manual") return reply.code(400).send({ message: "节点执行方式无效" });

    const nextExecutor: ProductWorkflowNodeExecutor = {
      type: nextType,
      applicationId: nextType === "aiApplication" ? body.executor?.applicationId || node.executor?.applicationId || buildNodeAgentApplicationId(templateId, nodeId) : undefined,
      label: String(body.executor?.label ?? (nextType === "aiApplication" ? "节点智能体" : nextType === "system" ? "系统执行器" : "人工处理")),
      runtime: body.executor?.runtime ?? (nextType === "aiApplication" ? "agent" : nextType === "system" ? "system" : "human"),
      inputMapping: body.executor?.inputMapping ?? node.executor?.inputMapping ?? {},
      outputMapping: body.executor?.outputMapping ?? node.executor?.outputMapping ?? {},
    };

    const updatedTemplate = ensureProductWorkflowNodeExecutors({
      ...template, updatedAt: new Date().toISOString(),
      nodes: template.nodes.map((n) => (n.id === nodeId ? { ...n, executor: nextExecutor } : n)),
    });

    ctx.workflowTemplates = ctx.workflowTemplates.map((t) => (t.id === templateId ? updatedTemplate : t));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return { applications: buildAiApplicationsFromTemplates([updatedTemplate]), template: updatedTemplate, message: "节点执行器已保存" };
  });

  // Runs
  app.get("/api/workflows/runs", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const query = request.query as { templateId?: string; meetingId?: string };
    const items = ctx.workflowRuns.filter((r) => {
      const matchesTemplate = query.templateId ? r.templateId === query.templateId : true;
      const matchesMeeting = query.meetingId ? r.meetingId === query.meetingId : true;
      return matchesTemplate && matchesMeeting;
    });
    return { items };
  });

  app.get("/api/workflows/runs/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const run = ctx.workflowRuns.find((r) => r.id === (request.params as { id: string }).id);
    if (!run) return reply.code(404).send({ message: "未找到对应运行记录" });
    return { run };
  });

  app.post("/api/workflows/runs", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { meetingId?: string; templateId?: string };
    const meeting = body.meetingId ? ctx.meetings.find((m) => m.id === body.meetingId) : null;
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议，无法启动流程" });

    const template = selectWorkflowTemplate(meeting, ctx.workflowTemplates, body.templateId);
    if (!template) return reply.code(404).send({ message: "未找到可用工作流模板" });

    const run = await createWorkflowRun(meeting, template);
    ctx.workflowRuns = [run, ...ctx.workflowRuns].sort(sortRunsByStartedAtDesc);
    await saveWorkflowRuns(ctx.workflowRuns);
    const memories = await persistWorkflowMemories(meeting, run, ctx);

    notifyWorkflowUpdate(ctx, run);
    return reply.code(201).send({ run, memoryCount: memories.length, message: run.status === "blocked" ? "流程已启动，但需要人工处理阻塞节点" : "流程已启动并完成运行" });
  });

  app.patch("/api/workflows/runs/:id/advance", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { resolutionNote?: string };
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
    const run = ctx.workflowRuns.find((r) => r.id === id);
    if (!run) return reply.code(404).send({ message: "未找到对应运行记录" });
    if (!resolutionNote) return reply.code(400).send({ message: "请填写阻塞处理说明" });
    if (!run.nodeRuns.some((nr) => nr.status === "blocked")) return reply.code(400).send({ message: "当前运行没有阻塞节点需要处理" });

    const meeting = ctx.meetings.find((m) => m.id === run.meetingId);
    const template = ctx.workflowTemplates.find((t) => t.id === run.templateId);
    if (!meeting || !template) return reply.code(404).send({ message: "关联的会议或模板已不存在" });

    const advancedRun = await advanceWorkflowExecution(run, meeting, template, resolutionNote);
    ctx.workflowRuns = ctx.workflowRuns.map((r) => (r.id === id ? advancedRun : r)).sort(sortRunsByStartedAtDesc);
    await saveWorkflowRuns(ctx.workflowRuns);
    const memories = await persistWorkflowMemories(meeting, advancedRun, ctx);
    notifyWorkflowUpdate(ctx, advancedRun);
    return { run: advancedRun, memoryCount: memories.length, message: "阻塞节点已处理，流程已继续运行" };
  });

  app.post("/api/workflows/runs/:id/retry", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const originalRun = ctx.workflowRuns.find((r) => r.id === id);
    if (!originalRun) return reply.code(404).send({ message: "未找到对应运行记录" });
    if (originalRun.status !== "failed") return reply.code(400).send({ message: "只有失败的运行可以重试" });

    const meeting = ctx.meetings.find((m) => m.id === originalRun.meetingId);
    const template = ctx.workflowTemplates.find((t) => t.id === originalRun.templateId);
    if (!meeting || !template) return reply.code(404).send({ message: "关联的会议或模板已不存在" });

    const newRun = await createWorkflowRun(meeting, template);
    ctx.workflowRuns = [newRun, ...ctx.workflowRuns].sort(sortRunsByStartedAtDesc);
    await saveWorkflowRuns(ctx.workflowRuns);
    const memories = await persistWorkflowMemories(meeting, newRun, ctx);
    notifyWorkflowUpdate(ctx, newRun);
    return reply.code(201).send({ run: newRun, memoryCount: memories.length, message: "流程已重新启动" });
  });

  app.post("/api/workflows/runs/:id/cancel", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const run = ctx.workflowRuns.find((r) => r.id === id);
    if (!run) return reply.code(404).send({ message: "未找到对应运行记录" });
    if (run.status === "completed" || run.status === "failed") return reply.code(400).send({ message: "该运行已结束，无法取消" });

    const cancelledRun: ProductWorkflowRun = {
      ...run, status: "failed", endedAt: new Date().toISOString(),
      logs: [...run.logs, { id: `log-${Date.now()}-cancel`, time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }), level: "warning", message: "流程已被用户取消" }],
    };

    ctx.workflowRuns = ctx.workflowRuns.map((r) => (r.id === id ? cancelledRun : r));
    await saveWorkflowRuns(ctx.workflowRuns);
    notifyWorkflowUpdate(ctx, cancelledRun);
    return { run: cancelledRun, message: "流程已取消" };
  });

  // Schedules
  app.get("/api/workflows/schedules", { preHandler: [authenticate] }, async () => ({
    items: getAllSchedules(),
  }));

  app.post("/api/workflows/schedules", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { templateId?: string; cronExpression?: string };
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const cronExpression = typeof body.cronExpression === "string" ? body.cronExpression.trim() : "";
    if (!templateId) return reply.code(400).send({ message: "请选择工作流模板" });
    if (!cronExpression) return reply.code(400).send({ message: "请填写 Cron 表达式" });

    const template = ctx.workflowTemplates.find((t) => t.id === templateId);
    if (!template) return reply.code(404).send({ message: "未找到对应模板" });

    const schedule = addSchedule({ id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, templateId, cronExpression, enabled: true });
    return reply.code(201).send({ schedule, message: "计划任务已创建" });
  });

  app.delete("/api/workflows/schedules/:id", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const id = (request.params as { id: string }).id;
    removeSchedule(id);
    return { deletedId: id, message: "计划任务已删除" };
  });
}

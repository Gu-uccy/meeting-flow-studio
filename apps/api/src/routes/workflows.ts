import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAiApplicationsFromTemplates, ensureProductWorkflowNodeExecutors, buildNodeAgentApplicationId } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import type { ProductWorkflowTemplate, ProductWorkflowNodeExecutor, ProductWorkflowRun } from "@meeting-flow/shared";
import { selectWorkflowTemplate, notifyWorkflowUpdate } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { assertMeetingEdit, assertWorkflowEditor } from "../lib/permissions.js";
import { recordAuditLog } from "../lib/audit.js";
import { saveWorkflowTemplates, saveWorkflowRuns } from "../workflowStore.js";
import { getAllSchedules, addSchedule, removeSchedule, updateSchedule } from "../services/scheduler.js";
import { buildWorkflowExecutionOptions } from "../lib/executionOptions.js";
import {
  createBlankWorkflowTemplate,
  cloneWorkflowTemplate,
  sanitizeImportedTemplate
} from "../lib/templateFactory.js";
import {
  applyWorkflowTemplateVersion,
  buildWorkflowTemplateVersion,
  demotePublishedTemplateVersions
} from "../lib/templateVersionFactory.js";
import {
  enqueueWorkflowAdvanceJob,
  enqueueWorkflowResumeJob,
  enqueueWorkflowRunJob,
  isWorkflowRunActive,
  markWorkflowRunCancelled
} from "../services/workflowJobRunner.js";

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

  app.post("/api/workflows/templates", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
    const body = request.body as {
      name?: string;
      description?: string;
      category?: ProductWorkflowTemplate["category"];
      sourceTemplateId?: string;
    };

    const sourceTemplateId = typeof body.sourceTemplateId === "string" ? body.sourceTemplateId.trim() : "";
    let template: ProductWorkflowTemplate;

    if (sourceTemplateId) {
      const source = ctx.workflowTemplates.find((item) => item.id === sourceTemplateId);
      if (!source) {
        return reply.code(404).send({ message: "未找到源工作流模板" });
      }
      template = cloneWorkflowTemplate(source, body.name);
    } else {
      template = createBlankWorkflowTemplate({
        name: body.name ?? "新建工作流",
        description: body.description,
        category: body.category
      });
    }

    ctx.workflowTemplates = [template, ...ctx.workflowTemplates];
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return reply.code(201).send({ template, message: "工作流模板已创建" });
  });

  app.post("/api/workflows/templates/:id/duplicate", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
    const id = (request.params as { id: string }).id;
    const body = request.body as { name?: string };
    const source = ctx.workflowTemplates.find((item) => item.id === id);
    if (!source) return reply.code(404).send({ message: "未找到对应工作流模板" });

    const template = cloneWorkflowTemplate(source, body.name);
    ctx.workflowTemplates = [template, ...ctx.workflowTemplates];
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return reply.code(201).send({ template, message: "工作流模板已复制" });
  });

  app.get("/api/workflows/templates/:id/export", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const template = ctx.workflowTemplates.find((item) => item.id === (request.params as { id: string }).id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${template.id}.json"`);
    return JSON.stringify(template, null, 2);
  });

  app.post("/api/workflows/templates/import", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
    const body = request.body as { template?: ProductWorkflowTemplate };
    if (!body.template) {
      return reply.code(400).send({ message: "请提供 template JSON" });
    }

    try {
      const template = sanitizeImportedTemplate(body.template);
      ctx.workflowTemplates = [template, ...ctx.workflowTemplates];
      await saveWorkflowTemplates(ctx.workflowTemplates);
      return reply.code(201).send({ template, message: "工作流模板已导入" });
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "导入失败" });
    }
  });

  app.delete("/api/workflows/templates/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
    const id = (request.params as { id: string }).id;
    const template = ctx.workflowTemplates.find((item) => item.id === id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });
    if (ctx.workflowTemplates.length <= 1) {
      return reply.code(400).send({ message: "至少需要保留一个工作流模板" });
    }

    const hasRuns = ctx.workflowRuns.some((run) => run.templateId === id);
    if (hasRuns) {
      return reply.code(400).send({ message: "该模板已有运行记录，无法删除" });
    }

    ctx.workflowTemplates = ctx.workflowTemplates.filter((item) => item.id !== id);
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return { deletedId: id, message: "工作流模板已删除" };
  });

  app.patch("/api/workflows/templates/:id/canvas", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
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
    await recordAuditLog({
      actor: request.user,
      action: "workflow.template_canvas_save",
      resourceType: "workflow_template",
      resourceId: updatedTemplate.id,
      summary: `保存工作流模板「${updatedTemplate.name}」画布`
    });
    return { template: updatedTemplate, message: "画布已保存" };
  });

  app.get("/api/workflows/templates/:id/versions", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const template = ctx.workflowTemplates.find((item) => item.id === id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });
    return { items: template.versions ?? [] };
  });

  app.post("/api/workflows/templates/:id/versions", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
    const id = (request.params as { id: string }).id;
    const body = request.body as { status?: "snapshot" | "published"; summary?: string };
    const template = ctx.workflowTemplates.find((item) => item.id === id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });

    const status = body.status === "published" ? "published" : "snapshot";
    const summary = typeof body.summary === "string" && body.summary.trim()
      ? body.summary.trim().slice(0, 160)
      : status === "published"
        ? "发布当前工作流模板"
        : "保存当前工作流模板快照";

    const version = buildWorkflowTemplateVersion(template, status, summary, request.user.name);
    const nextVersions = status === "published"
      ? demotePublishedTemplateVersions(template.versions ?? [], version.id)
      : (template.versions ?? []);

    const updatedTemplate = ensureProductWorkflowNodeExecutors({
      ...template,
      status: status === "published" ? "published" : template.status,
      updatedAt: version.createdAt,
      versions: [version, ...nextVersions].slice(0, 30)
    });

    ctx.workflowTemplates = ctx.workflowTemplates.map((item) => (item.id === id ? updatedTemplate : item));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return reply.code(201).send({
      template: updatedTemplate,
      version,
      message: status === "published" ? "工作流模板版本已发布" : "工作流模板版本已保存"
    });
  });

  app.post("/api/workflows/templates/:id/versions/:versionId/apply", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
    const { id, versionId } = request.params as { id: string; versionId: string };
    const template = ctx.workflowTemplates.find((item) => item.id === id);
    if (!template) return reply.code(404).send({ message: "未找到对应工作流模板" });

    const version = (template.versions ?? []).find((item) => item.id === versionId);
    if (!version) return reply.code(404).send({ message: "未找到对应的工作流模板版本" });

    const updatedTemplate = applyWorkflowTemplateVersion(template, version);
    ctx.workflowTemplates = ctx.workflowTemplates.map((item) => (item.id === id ? updatedTemplate : item));
    await saveWorkflowTemplates(ctx.workflowTemplates);
    return {
      template: updatedTemplate,
      version,
      message: "工作流模板已回滚到选定版本"
    };
  });

  app.patch("/api/workflows/templates/:templateId/nodes/:nodeId/config", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    if (!assertWorkflowEditor(request.user, reply)) return reply;
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
    if (!assertWorkflowEditor(request.user, reply)) return reply;
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
    const query = request.query as { templateId?: string; meetingId?: string; status?: ProductWorkflowRun["status"] };
    const items = ctx.workflowRuns.filter((r) => {
      const matchesTemplate = query.templateId ? r.templateId === query.templateId : true;
      const matchesMeeting = query.meetingId ? r.meetingId === query.meetingId : true;
      const matchesStatus = query.status ? r.status === query.status : true;
      return matchesTemplate && matchesMeeting && matchesStatus;
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
    if (!assertMeetingEdit(request.user, meeting, reply)) return reply;

    const template = selectWorkflowTemplate(meeting, ctx.workflowTemplates, body.templateId);
    if (!template) return reply.code(404).send({ message: "未找到可用工作流模板" });

    const run = await enqueueWorkflowRunJob(ctx, meeting, template, await buildWorkflowExecutionOptions(request.user.id));

    await recordAuditLog({
      actor: request.user,
      meeting,
      action: "workflow.run_start",
      resourceType: "workflow_run",
      resourceId: run.id,
      summary: `启动会议「${meeting.title}」流程`,
      metadata: { meetingId: meeting.id, templateId: template.id }
    });

    return reply.code(201).send({
      run,
      memoryCount: 0,
      message: run.status === "running" ? "流程已启动，正在后台执行" : "流程已启动"
    });
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
    if (!assertMeetingEdit(request.user, meeting, reply)) return reply;

    const advancedRun = await enqueueWorkflowAdvanceJob(
      ctx,
      meeting,
      template,
      run,
      resolutionNote,
      await buildWorkflowExecutionOptions(request.user.id)
    );

    return {
      run: advancedRun,
      memoryCount: 0,
      message: advancedRun.status === "running" ? "阻塞已处理，流程正在后台继续运行" : "阻塞节点已处理，流程已继续运行"
    };
  });

  app.post("/api/workflows/runs/:id/retry", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const originalRun = ctx.workflowRuns.find((r) => r.id === id);
    if (!originalRun) return reply.code(404).send({ message: "未找到对应运行记录" });
    if (originalRun.status !== "failed") return reply.code(400).send({ message: "只有失败的运行可以重试" });

    const meeting = ctx.meetings.find((m) => m.id === originalRun.meetingId);
    const template = ctx.workflowTemplates.find((t) => t.id === originalRun.templateId);
    if (!meeting || !template) return reply.code(404).send({ message: "关联的会议或模板已不存在" });
    if (!assertMeetingEdit(request.user, meeting, reply)) return reply;

    const newRun = await enqueueWorkflowResumeJob(
      ctx,
      meeting,
      template,
      originalRun,
      await buildWorkflowExecutionOptions(request.user.id)
    );

    return reply.code(201).send({
      run: newRun,
      memoryCount: 0,
      message: "已从失败节点断点续跑"
    });
  });

  app.post("/api/workflows/runs/:id/cancel", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const run = ctx.workflowRuns.find((r) => r.id === id);
    if (!run) return reply.code(404).send({ message: "未找到对应运行记录" });
    if (run.status === "completed" || run.status === "failed") return reply.code(400).send({ message: "该运行已结束，无法取消" });
    if (!isWorkflowRunActive(run.id)) return reply.code(400).send({ message: "该运行当前不在执行中" });

    const meeting = ctx.meetings.find((m) => m.id === run.meetingId);
    if (!meeting) return reply.code(404).send({ message: "关联的会议已不存在" });
    if (!assertMeetingEdit(request.user, meeting, reply)) return reply;

    markWorkflowRunCancelled(run.id);

    const cancellingRun: ProductWorkflowRun = {
      ...run,
      logs: [
        ...run.logs,
        {
          id: `log-${Date.now()}-cancel-request`,
          time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          level: "warning",
          message: "已请求取消，正在停止后续节点"
        }
      ]
    };

    ctx.workflowRuns = ctx.workflowRuns.map((r) => (r.id === id ? cancellingRun : r));
    await saveWorkflowRuns(ctx.workflowRuns);
    notifyWorkflowUpdate(ctx, cancellingRun);
    await recordAuditLog({
      actor: request.user,
      meeting,
      action: "workflow.run_cancel",
      resourceType: "workflow_run",
      resourceId: cancellingRun.id,
      summary: `取消会议「${meeting.title}」流程运行`,
      metadata: { meetingId: meeting.id }
    });
    return { run: cancellingRun, message: "取消请求已提交" };
  });

  // Schedules
  app.get("/api/workflows/schedules", { preHandler: [authenticate] }, async () => ({
    items: getAllSchedules(),
  }));

  app.post("/api/workflows/schedules", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { templateId?: string; cronExpression?: string; meetingId?: string };
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const cronExpression = typeof body.cronExpression === "string" ? body.cronExpression.trim() : "";
    const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
    if (!templateId) return reply.code(400).send({ message: "请选择工作流模板" });
    if (!cronExpression) return reply.code(400).send({ message: "请填写 Cron 表达式" });

    const template = ctx.workflowTemplates.find((t) => t.id === templateId);
    if (!template) return reply.code(404).send({ message: "未找到对应模板" });

    if (meetingId) {
      const meeting = ctx.meetings.find((item) => item.id === meetingId);
      if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });
      if (!assertMeetingEdit(request.user, meeting, reply)) return reply;
    } else if (!assertWorkflowEditor(request.user, reply)) {
      return reply;
    }

    const schedule = await addSchedule({
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      templateId,
      cronExpression,
      enabled: true,
      meetingId: meetingId || undefined,
      executionHistory: []
    });
    return reply.code(201).send({ schedule, message: "计划任务已创建" });
  });

  app.patch("/api/workflows/schedules/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { enabled?: boolean; meetingId?: string | null; cronExpression?: string };
    const existing = getAllSchedules().find((item) => item.id === id);
    if (!existing) return reply.code(404).send({ message: "未找到对应计划任务" });

    const targetMeetingId = body.meetingId === null
      ? undefined
      : typeof body.meetingId === "string" && body.meetingId.trim()
        ? body.meetingId.trim()
        : existing.meetingId;

    if (targetMeetingId) {
      const meeting = ctx.meetings.find((item) => item.id === targetMeetingId);
      if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });
      if (!assertMeetingEdit(request.user, meeting, reply)) return reply;
    } else if (!assertWorkflowEditor(request.user, reply)) {
      return reply;
    }

    const schedule = await updateSchedule(id, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
      meetingId: body.meetingId === null ? undefined : typeof body.meetingId === "string" ? body.meetingId.trim() || undefined : existing.meetingId,
      cronExpression: typeof body.cronExpression === "string" && body.cronExpression.trim() ? body.cronExpression.trim() : existing.cronExpression
    });

    if (!schedule) return reply.code(404).send({ message: "未找到对应计划任务" });
    return { schedule, message: "计划任务已更新" };
  });

  app.delete("/api/workflows/schedules/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const existing = getAllSchedules().find((item) => item.id === id);
    if (!existing) return reply.code(404).send({ message: "未找到对应计划任务" });

    if (existing.meetingId) {
      const meeting = ctx.meetings.find((item) => item.id === existing.meetingId);
      if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });
      if (!assertMeetingEdit(request.user, meeting, reply)) return reply;
    } else if (!assertWorkflowEditor(request.user, reply)) {
      return reply;
    }

    await removeSchedule(id);
    return { deletedId: id, message: "计划任务已删除" };
  });
}

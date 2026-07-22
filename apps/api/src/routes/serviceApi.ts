import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAiApplicationsFromTemplates } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import { selectWorkflowTemplate } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { buildPermissions, toPublicUser } from "../services/auth.js";
import { findUserById } from "../userStore.js";
import { buildWorkflowExecutionOptions } from "../lib/executionOptions.js";
import { enqueueWorkflowRunJob } from "../services/workflowJobRunner.js";
import {
  authenticateServiceKey,
  createServiceKey,
  deleteServiceKey,
  isServiceKey,
  listServiceKeys
} from "../serviceKeyStore.js";

function extractBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

export async function serviceApiRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post("/api/apps/:id/service-keys", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const applicationId = (request.params as { id: string }).id;
    const body = request.body as { label?: string };
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((item) => item.id === applicationId);

    if (!application) {
      return reply.code(404).send({ message: "应用不存在" });
    }

    const created = await createServiceKey({
      applicationId,
      userId: request.user.id,
      label: body.label
    });

    return reply.code(201).send({
      key: created.key,
      serviceKey: created.record,
      message: "Service API Key 已创建，请立即保存，之后无法再次查看完整密钥"
    });
  });

  app.get("/api/apps/:id/service-keys", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const applicationId = (request.params as { id: string }).id;
    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((item) => item.id === applicationId);

    if (!application) {
      return reply.code(404).send({ message: "应用不存在" });
    }

    return {
      items: await listServiceKeys(applicationId, request.user.id)
    };
  });

  app.delete("/api/apps/:id/service-keys/:keyId", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { keyId } = request.params as { id: string; keyId: string };
    const deleted = await deleteServiceKey(keyId, request.user.id);

    if (!deleted) {
      return reply.code(404).send({ message: "未找到对应 Service API Key" });
    }

    return { deletedId: keyId, message: "Service API Key 已删除" };
  });

  app.post("/api/v1/apps/:applicationId/run", async (request: FastifyRequest, reply) => {
    const applicationId = (request.params as { applicationId: string }).applicationId;
    const token = extractBearerToken(request);

    if (!token || !isServiceKey(token)) {
      return reply.code(401).send({ message: "请提供有效的 Service API Key" });
    }

    const auth = await authenticateServiceKey(token);
    if (!auth || auth.applicationId !== applicationId) {
      return reply.code(401).send({ message: "Service API Key 无效或与应用不匹配" });
    }

    const application = buildAiApplicationsFromTemplates(ctx.workflowTemplates).find((item) => item.id === applicationId);
    if (!application) {
      return reply.code(404).send({ message: "应用不存在" });
    }

    const body = request.body as { meetingId?: string; templateId?: string };
    const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
    if (!meetingId) {
      return reply.code(400).send({ message: "请提供 meetingId" });
    }

    const meeting = ctx.meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    const owner = await findUserById(auth.userId);
    if (!owner) {
      return reply.code(401).send({ message: "Service API Key 所属用户不存在" });
    }

    const permissions = buildPermissions(await toPublicUser(owner), meeting);
    if (!permissions.canEdit) {
      return reply.code(403).send({ message: "当前 Service Key 无权运行该会议工作流" });
    }

    const template = selectWorkflowTemplate(meeting, ctx.workflowTemplates, body.templateId ?? application.templateId);
    if (!template) {
      return reply.code(404).send({ message: "未找到可用工作流模板" });
    }

    const run = await enqueueWorkflowRunJob(ctx, meeting, template, await buildWorkflowExecutionOptions(auth.userId));

    return reply.code(202).send({
      run,
      message: "工作流已通过 Service API 启动，正在后台执行"
    });
  });
}

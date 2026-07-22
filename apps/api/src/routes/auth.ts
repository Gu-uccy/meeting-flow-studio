import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerInputSchema, loginInputSchema, switchWorkspaceInputSchema } from "@meeting-flow/shared";
import { registerUser, loginUser, createAuthPreHandler, switchUserWorkspace } from "../services/auth.js";
import { recordAuditLog } from "../lib/audit.js";
import { findWorkspaceById } from "../workspaceStore.js";

export const authenticate = createAuthPreHandler();

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    const payload = registerInputSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "注册参数不合法", issues: payload.error.flatten() });
    }
    try {
      const result = await registerUser(app, payload.data.email, payload.data.password, payload.data.name);
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(409).send({ message: error instanceof Error ? error.message : "注册失败" });
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const payload = loginInputSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "登录参数不合法", issues: payload.error.flatten() });
    }
    try {
      const result = await loginUser(app, payload.data.email, payload.data.password);
      return reply.send(result);
    } catch {
      return reply.code(401).send({ message: "邮箱或密码错误" });
    }
  });

  app.get("/api/auth/me", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    return {
      user: request.user,
      effectiveRole: request.user.effectiveRole
    };
  });

  app.patch("/api/auth/me/workspace", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const payload = switchWorkspaceInputSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "工作区切换参数不合法", issues: payload.error.flatten() });
    }

    try {
      const result = await switchUserWorkspace(app, request.user.id, payload.data.workspaceId);
      const workspace = await findWorkspaceById(payload.data.workspaceId);
      await recordAuditLog({
        workspaceId: payload.data.workspaceId,
        actor: result.user,
        action: "workspace.switch",
        resourceType: "workspace",
        resourceId: payload.data.workspaceId,
        summary: `切换到工作区「${workspace?.name ?? payload.data.workspaceId}」`
      });
      return reply.send(result);
    } catch (error) {
      return reply.code(403).send({ message: error instanceof Error ? error.message : "无法切换工作区" });
    }
  });
}

import type { FastifyInstance, FastifyRequest } from "fastify";
import { registerInputSchema, loginInputSchema } from "@meeting-flow/shared";
import { registerUser, loginUser, createAuthPreHandler } from "../services/auth.js";

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
    return { user: request.user };
  });
}

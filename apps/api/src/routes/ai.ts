import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../routes/auth.js";
import { getAiKeyStatus, saveUserAiApiKey, deleteUserAiApiKey } from "../aiKeyStore.js";

export async function aiRoutes(app: FastifyInstance) {
  app.get("/api/ai/settings", { preHandler: [authenticate] }, async (request: FastifyRequest) => ({
    settings: await getAiKeyStatus(request.user.id),
  }));

  app.put("/api/ai/settings", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { apiKey?: string };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) return reply.code(400).send({ message: "请填写模型 API Key" });
    const settings = await saveUserAiApiKey(request.user.id, apiKey);
    return { settings, message: "AI API Key 已保存" };
  });

  app.delete("/api/ai/settings", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const settings = await deleteUserAiApiKey(request.user.id);
    return { settings, message: "AI API Key 已删除" };
  });
}

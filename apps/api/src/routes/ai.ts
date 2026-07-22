import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../routes/auth.js";
import { getAiKeyStatus, saveUserAiService, deleteUserAiApiKey } from "../aiKeyStore.js";

export async function aiRoutes(app: FastifyInstance) {
  app.get("/api/ai/settings", { preHandler: [authenticate] }, async (request: FastifyRequest) => ({
    settings: await getAiKeyStatus(request.user.id)
  }));

  app.put("/api/ai/settings", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as {
      apiKey?: string;
      baseUrl?: string;
      chatModel?: string;
      embeddingModel?: string;
    };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
      return reply.code(400).send({ message: "请填写 AI API Key" });
    }

    const settings = await saveUserAiService({
      userId: request.user.id,
      apiKey,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
      chatModel: typeof body.chatModel === "string" ? body.chatModel : undefined,
      embeddingModel: typeof body.embeddingModel === "string" ? body.embeddingModel : undefined
    });

    return { settings, message: "AI 服务配置已保存（对话与向量检索共用）" };
  });

  app.delete("/api/ai/settings", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const settings = await deleteUserAiApiKey(request.user.id);
    return { settings, message: "AI 服务配置已删除" };
  });
}

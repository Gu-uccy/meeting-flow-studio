import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContext } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { getEmbeddingProvider } from "../services/embeddings.js";
import { retrieveMeetingKnowledge } from "../services/knowledgeRetrieval.js";
import { getVectorIndexStats, searchVectorKnowledge, syncVectorKnowledgeIndex } from "../vectorStore.js";

export async function knowledgeRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/knowledge/search", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const query = request.query as { meetingId?: string; q?: string; limit?: string };
    const meetingId = typeof query.meetingId === "string" ? query.meetingId.trim() : "";
    const searchQuery = typeof query.q === "string" ? query.q.trim() : "";
    const limit = Math.min(12, Math.max(1, Number(query.limit ?? 6) || 6));

    if (!meetingId) {
      return reply.code(400).send({ message: "请提供 meetingId" });
    }

    const meeting = ctx.meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    if (!searchQuery) {
      return reply.code(400).send({ message: "请提供检索 query" });
    }

    const hits = await searchVectorKnowledge({
      meetingId,
      query: searchQuery,
      topK: limit
    });

    return {
      embeddingModel: getEmbeddingProvider(),
      items: hits.map((hit) => ({
        id: hit.id,
        sourceId: hit.sourceId,
        kind: hit.kind,
        content: hit.content,
        sourceType: hit.sourceType,
        similarity: Number(hit.similarity.toFixed(4)),
        updatedAt: hit.updatedAt
      }))
    };
  });

  app.post("/api/knowledge/retrieve", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { meetingId?: string; maxDocs?: number; query?: string; sources?: string; missingPolicy?: string };
    const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
    if (!meetingId) {
      return reply.code(400).send({ message: "请提供 meetingId" });
    }

    const meeting = ctx.meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    const result = await retrieveMeetingKnowledge(meeting, {
      maxDocs: body.maxDocs,
      missingPolicy: body.missingPolicy,
      query: body.query,
      sources: body.sources
    });

    return { result };
  });

  app.get("/api/knowledge/index", { preHandler: [authenticate] }, async () => {
    const stats = await getVectorIndexStats();
    return { index: stats };
  });

  app.post("/api/knowledge/index/rebuild", { preHandler: [authenticate] }, async () => {
    const index = await syncVectorKnowledgeIndex(ctx.meetingMemories, ctx.meetings);
    return { index, message: "向量索引已重建" };
  });
}

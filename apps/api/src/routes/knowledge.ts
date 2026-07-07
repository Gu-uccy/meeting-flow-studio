import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContext } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { buildPermissions } from "../services/auth.js";
import { getEmbeddingProvider } from "../services/embeddings.js";
import { retrieveMeetingKnowledge } from "../services/knowledgeRetrieval.js";
import { getVectorIndexStats, searchVectorKnowledge, syncVectorKnowledgeIndex } from "../vectorStore.js";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments
} from "../knowledgeDocumentStore.js";

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
    const documents = await listKnowledgeDocuments();
    const index = await syncVectorKnowledgeIndex(ctx.meetingMemories, ctx.meetings, documents);
    return { index, message: "向量索引已重建" };
  });

  app.get("/api/knowledge/documents", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const query = request.query as { meetingId?: string };
    const meetingId = typeof query.meetingId === "string" ? query.meetingId.trim() : "";

    if (meetingId) {
      const meeting = ctx.meetings.find((item) => item.id === meetingId);
      if (!meeting) {
        return reply.code(404).send({ message: "未找到对应会议" });
      }
    }

    return { items: await listKnowledgeDocuments(meetingId || undefined) };
  });

  app.post("/api/knowledge/documents", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { meetingId?: string; title?: string; content?: string; format?: "markdown" | "text" };
    const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!meetingId) {
      return reply.code(400).send({ message: "请提供 meetingId" });
    }
    if (!content) {
      return reply.code(400).send({ message: "请填写文档内容" });
    }

    const meeting = ctx.meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canEdit) {
      return reply.code(403).send({ message: "当前账号无权上传知识文档" });
    }

    const document = await createKnowledgeDocument({
      meetingId,
      ownerUserId: request.user.id,
      title: typeof body.title === "string" ? body.title : "知识文档",
      content,
      format: body.format === "markdown" ? "markdown" : "text"
    });

    const documents = await listKnowledgeDocuments();
    await syncVectorKnowledgeIndex(ctx.meetingMemories, ctx.meetings, documents);

    return reply.code(201).send({ document, message: "知识文档已上传并加入向量索引" });
  });

  app.delete("/api/knowledge/documents/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const items = await listKnowledgeDocuments();
    const document = items.find((item) => item.id === id);

    if (!document) {
      return reply.code(404).send({ message: "未找到对应知识文档" });
    }

    const meeting = ctx.meetings.find((item) => item.id === document.meetingId);
    if (meeting) {
      const permissions = buildPermissions(request.user, meeting);
      if (!permissions.canEdit && document.ownerUserId !== request.user.id && request.user.role !== "admin") {
        return reply.code(403).send({ message: "当前账号无权删除该知识文档" });
      }
    }

    await deleteKnowledgeDocument(id);
    const documents = await listKnowledgeDocuments();
    await syncVectorKnowledgeIndex(ctx.meetingMemories, ctx.meetings, documents);

    return { deletedId: id, message: "知识文档已删除" };
  });
}

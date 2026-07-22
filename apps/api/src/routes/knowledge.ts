import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContext } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { buildPermissions } from "../services/auth.js";
import { resolveEmbeddingRuntime } from "../services/embeddings.js";
import { retrieveMeetingKnowledge } from "../services/knowledgeRetrieval.js";
import { recordAuditLog } from "../lib/audit.js";
import { assertMeetingAccess, assertMeetingEdit } from "../lib/permissions.js";
import { filterMeetingsForUser } from "../lib/workspaceAccess.js";
import { getVectorIndexStats, searchVectorKnowledge, syncVectorKnowledgeIndex } from "../vectorStore.js";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  ensureDemoKnowledgePackForMeeting,
  listKnowledgeDocuments
} from "../knowledgeDocumentStore.js";

async function resolveUserEmbedding(userId: string) {
  try {
    const runtime = await resolveEmbeddingRuntime(userId);
    return { runtime, error: null as string | null };
  } catch (error) {
    return {
      runtime: null,
      error: error instanceof Error ? error.message : "向量能力不可用"
    };
  }
}

async function listAccessibleKnowledgeDocuments(ctx: AppContext, user: FastifyRequest["user"], meetingId?: string) {
  const accessibleMeetingIds = new Set(filterMeetingsForUser(ctx.meetings, user).map((meeting) => meeting.id));
  const documents = await listKnowledgeDocuments(meetingId || undefined);
  return documents.filter((document) => accessibleMeetingIds.has(document.meetingId));
}

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
    if (!assertMeetingAccess(request.user, meeting, reply)) return reply;

    if (!searchQuery) {
      return reply.code(400).send({ message: "请提供检索 query" });
    }

    const resolved = await resolveUserEmbedding(request.user.id);
    if (!resolved.runtime) {
      return reply.code(503).send({ message: resolved.error });
    }

    const hits = await searchVectorKnowledge({
      meetingId,
      query: searchQuery,
      topK: limit,
      runtime: resolved.runtime
    });

    return {
      embeddingModel: `openai-compatible:${resolved.runtime.embeddingModel}`,
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
    if (!assertMeetingAccess(request.user, meeting, reply)) return reply;

    const resolved = await resolveUserEmbedding(request.user.id);
    const result = await retrieveMeetingKnowledge(meeting, {
      maxDocs: body.maxDocs,
      missingPolicy: body.missingPolicy,
      query: body.query,
      sources: body.sources,
      runtime: resolved.runtime ?? undefined
    });

    return { result };
  });

  app.get("/api/knowledge/index", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const resolved = await resolveUserEmbedding(request.user.id);
    const stats = await getVectorIndexStats(resolved.runtime ?? undefined);
    return { index: stats, available: Boolean(resolved.runtime) };
  });

  app.post("/api/knowledge/index/rebuild", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const resolved = await resolveUserEmbedding(request.user.id);
    if (!resolved.runtime) {
      return reply.code(503).send({ message: resolved.error });
    }

    const accessibleMeetings = filterMeetingsForUser(ctx.meetings, request.user);
    const documents = await listAccessibleKnowledgeDocuments(ctx, request.user);
    const index = await syncVectorKnowledgeIndex(ctx.meetingMemories, accessibleMeetings, documents, resolved.runtime);
    await recordAuditLog({
      actor: request.user,
      action: "knowledge.index_rebuild",
      resourceType: "knowledge_index",
      resourceId: "vector-index",
      summary: `重建知识库向量索引（${index.chunkCount} 个分片）`,
      metadata: { chunkCount: index.chunkCount, embeddingModel: index.embeddingModel }
    });
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
      if (!assertMeetingAccess(request.user, meeting, reply)) return reply;
      return { items: await listKnowledgeDocuments(meetingId) };
    }

    return { items: await listAccessibleKnowledgeDocuments(ctx, request.user) };
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
    if (!assertMeetingEdit(request.user, meeting, reply, "当前账号无权上传知识文档")) return reply;

    const resolved = await resolveUserEmbedding(request.user.id);
    if (!resolved.runtime) {
      return reply.code(503).send({ message: resolved.error });
    }

    const document = await createKnowledgeDocument({
      meetingId,
      ownerUserId: request.user.id,
      title: typeof body.title === "string" ? body.title : "知识文档",
      content,
      format: body.format === "markdown" ? "markdown" : "text"
    });

    const documents = await listAccessibleKnowledgeDocuments(ctx, request.user);
    await syncVectorKnowledgeIndex(
      ctx.meetingMemories,
      filterMeetingsForUser(ctx.meetings, request.user),
      documents,
      resolved.runtime
    );

    await recordAuditLog({
      actor: request.user,
      action: "knowledge.document_create",
      resourceType: "knowledge_document",
      resourceId: document.id,
      summary: `上传知识文档「${document.title}」`,
      meeting,
      metadata: { documentId: document.id, format: document.format }
    });

    return reply.code(201).send({ document, message: "知识文档已上传并加入向量索引" });
  });

  app.post("/api/knowledge/documents/seed-demo", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = request.body as { meetingId?: string };
    const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";

    if (!meetingId) {
      return reply.code(400).send({ message: "请提供 meetingId" });
    }

    const meeting = ctx.meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }
    if (!assertMeetingEdit(request.user, meeting, reply, "当前账号无权填充示例文档")) return reply;

    const created = await ensureDemoKnowledgePackForMeeting(meetingId, request.user.id);
    const items = await listKnowledgeDocuments(meetingId);
    const resolved = await resolveUserEmbedding(request.user.id);

    if (created.length > 0 && resolved.runtime) {
      try {
        const documents = await listAccessibleKnowledgeDocuments(ctx, request.user);
        await syncVectorKnowledgeIndex(
          ctx.meetingMemories,
          filterMeetingsForUser(ctx.meetings, request.user),
          documents,
          resolved.runtime
        );
      } catch {
        // Demo pack should still succeed even if embeddings fail.
      }
    }

    await recordAuditLog({
      actor: request.user,
      action: "knowledge.document_seed_demo",
      resourceType: "knowledge_document",
      resourceId: meetingId,
      summary: created.length > 0 ? `为会议填充 ${created.length} 篇示例文档` : "示例文档已存在，跳过填充",
      meeting,
      metadata: { createdCount: created.length }
    });

    return {
      createdCount: created.length,
      items,
      message: created.length > 0 ? `已填充 ${created.length} 篇示例文档` : "示例文档已存在"
    };
  });

  app.delete("/api/knowledge/documents/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const items = await listKnowledgeDocuments();
    const document = items.find((item) => item.id === id);

    if (!document) {
      return reply.code(404).send({ message: "未找到对应知识文档" });
    }

    const meeting = ctx.meetings.find((item) => item.id === document.meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }
    if (!assertMeetingAccess(request.user, meeting, reply)) return reply;

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canEdit && document.ownerUserId !== request.user.id && request.user.role !== "admin") {
      return reply.code(403).send({ message: "当前账号无权删除该知识文档" });
    }

    await deleteKnowledgeDocument(id);
    const resolved = await resolveUserEmbedding(request.user.id);
    if (resolved.runtime) {
      const documents = await listAccessibleKnowledgeDocuments(ctx, request.user);
      await syncVectorKnowledgeIndex(
        ctx.meetingMemories,
        filterMeetingsForUser(ctx.meetings, request.user),
        documents,
        resolved.runtime
      );
    }

    await recordAuditLog({
      actor: request.user,
      action: "knowledge.document_delete",
      resourceType: "knowledge_document",
      resourceId: id,
      summary: `删除知识文档「${document.title}」`,
      meeting,
      metadata: { documentId: id }
    });

    return { deletedId: id, message: "知识文档已删除" };
  });
}

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MeetingMemory } from "@meeting-flow/shared";
import { meetingMemoryKindLabels, meetingMemoryKindValues, meetingMemoryVisibilityValues } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import { canAccessMemory, canManageMemory, scoreMemoryForMeeting } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { saveMeetingMemories } from "../memoryStore.js";

export async function memoryRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/memories", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const query = request.query as { meetingId?: string; kind?: string; limit?: string };
    const meeting = query.meetingId ? ctx.meetings.find((m) => m.id === query.meetingId) : undefined;
    const limit = Math.min(24, Math.max(1, Number(query.limit ?? 8) || 8));
    const kind = typeof query.kind === "string" ? query.kind : "";
    const now = Date.now();

    const items = ctx.meetingMemories
      .filter((m) => canAccessMemory(m, request.user, ctx))
      .filter((m) => (kind ? m.kind === kind : true))
      .filter((m) => (m.expiresAt ? new Date(m.expiresAt).getTime() > now : true))
      .map((m) => ({ ...m, kindLabel: meetingMemoryKindLabels[m.kind], relevanceScore: scoreMemoryForMeeting(m, meeting) }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    return { items };
  });

  app.patch("/api/memories/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as Partial<Pick<MeetingMemory, "content" | "kind" | "visibility" | "isPinned">>;
    const memory = ctx.meetingMemories.find((m) => m.id === id);
    if (!memory) return reply.code(404).send({ message: "未找到对应会议记忆" });
    if (!canManageMemory(memory, request.user, ctx)) return reply.code(403).send({ message: "当前账号无权管理这条会议记忆" });
    if (body.kind && !meetingMemoryKindValues.includes(body.kind)) return reply.code(400).send({ message: "会议记忆类型无效" });
    if (body.visibility && !meetingMemoryVisibilityValues.includes(body.visibility)) return reply.code(400).send({ message: "会议记忆可见范围无效" });

    const content = typeof body.content === "string" ? body.content.trim() : memory.content;
    if (!content) return reply.code(400).send({ message: "会议记忆内容不能为空" });

    const updated: MeetingMemory = { ...memory, content, kind: body.kind ?? memory.kind, visibility: body.visibility ?? memory.visibility, isPinned: typeof body.isPinned === "boolean" ? body.isPinned : memory.isPinned, updatedAt: new Date().toISOString() };
    ctx.meetingMemories = ctx.meetingMemories.map((m) => (m.id === id ? updated : m)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    await saveMeetingMemories(ctx.meetingMemories);
    return { memory: updated, message: "会议记忆已更新" };
  });

  app.delete("/api/memories/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const memory = ctx.meetingMemories.find((m) => m.id === id);
    if (!memory) return reply.code(404).send({ message: "未找到对应会议记忆" });
    if (!canManageMemory(memory, request.user, ctx)) return reply.code(403).send({ message: "当前账号无权删除这条会议记忆" });
    ctx.meetingMemories = ctx.meetingMemories.filter((m) => m.id !== id);
    await saveMeetingMemories(ctx.meetingMemories);
    return { message: "会议记忆已删除" };
  });
}

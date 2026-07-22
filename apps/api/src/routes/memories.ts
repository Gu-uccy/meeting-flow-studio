import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MeetingMemory, MeetingMemoryKind, MeetingMemoryVisibility } from "@meeting-flow/shared";
import {
  meetingMemoryKindLabels,
  meetingMemoryKindValues,
  meetingMemoryVisibilityValues
} from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import { canAccessMemory, canManageMemory, scoreMemoryForMeeting } from "../lib/context.js";
import { buildPermissions } from "../services/auth.js";
import { authenticate } from "../routes/auth.js";
import { saveMeetingMemories } from "../memoryStore.js";

type CreateMemoryBody = {
  meetingId?: string;
  content?: string;
  kind?: MeetingMemoryKind;
  visibility?: MeetingMemoryVisibility;
  isPinned?: boolean;
};

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

  app.post("/api/memories", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const body = (request.body ?? {}) as CreateMemoryBody;
    const meetingId = typeof body.meetingId === "string" ? body.meetingId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const kind = body.kind ?? "preference";
    const visibility = body.visibility ?? "team";
    const isPinned = typeof body.isPinned === "boolean" ? body.isPinned : false;

    if (!meetingId) {
      return reply.code(400).send({ message: "请指定会议" });
    }
    if (!content) {
      return reply.code(400).send({ message: "会议记忆内容不能为空" });
    }
    if (!meetingMemoryKindValues.includes(kind)) {
      return reply.code(400).send({ message: "会议记忆类型无效" });
    }
    if (!meetingMemoryVisibilityValues.includes(visibility)) {
      return reply.code(400).send({ message: "会议记忆可见范围无效" });
    }

    const meeting = ctx.meetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }
    if (!buildPermissions(request.user, meeting).canEdit) {
      return reply.code(403).send({ message: "当前账号无权为该会议创建记忆" });
    }

    const now = new Date().toISOString();
    const memory: MeetingMemory = {
      id: `memory-manual-${randomUUID()}`,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingType: meeting.type,
      ownerUserId: request.user.id,
      sourceRunId: "",
      kind,
      content,
      source: "手工创建",
      visibility,
      confidence: 1,
      isPinned,
      tags: [...new Set([meeting.type, meeting.priority, ...meeting.tags].filter(Boolean))],
      relatedParticipantNames: meeting.participants.map((participant) => participant.name),
      createdAt: now,
      updatedAt: now
    };

    ctx.meetingMemories = [memory, ...ctx.meetingMemories].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
    await saveMeetingMemories(ctx.meetingMemories, ctx.meetings);
    return reply.code(201).send({ memory, message: "会议记忆已创建" });
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

    const updated: MeetingMemory = {
      ...memory,
      content,
      kind: body.kind ?? memory.kind,
      visibility: body.visibility ?? memory.visibility,
      isPinned: typeof body.isPinned === "boolean" ? body.isPinned : memory.isPinned,
      updatedAt: new Date().toISOString()
    };
    ctx.meetingMemories = ctx.meetingMemories
      .map((m) => (m.id === id ? updated : m))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    await saveMeetingMemories(ctx.meetingMemories, ctx.meetings);
    return { memory: updated, message: "会议记忆已更新" };
  });

  app.delete("/api/memories/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const memory = ctx.meetingMemories.find((m) => m.id === id);
    if (!memory) return reply.code(404).send({ message: "未找到对应会议记忆" });
    if (!canManageMemory(memory, request.user, ctx)) return reply.code(403).send({ message: "当前账号无权删除这条会议记忆" });
    ctx.meetingMemories = ctx.meetingMemories.filter((m) => m.id !== id);
    await saveMeetingMemories(ctx.meetingMemories, ctx.meetings);
    return { message: "会议记忆已删除" };
  });
}

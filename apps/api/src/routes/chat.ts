import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppContext } from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { buildPermissions } from "../services/auth.js";
import { getUserAiApiKey } from "../aiKeyStore.js";
import { recordAuditLog } from "../lib/audit.js";
import { getMeetingChatMessages, resetMeetingChat, sendMeetingChatMessage } from "../services/meetingChat.js";

export async function chatRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/meetings/:id/chat/messages", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((item) => item.id === id);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canViewMinutes) {
      return reply.code(403).send({ message: "当前账号无权查看该会议对话" });
    }

    const items = await getMeetingChatMessages(id);
    return { items };
  });

  app.post("/api/meetings/:id/chat/messages", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const body = request.body as { content?: string } | null;
    const meeting = ctx.meetings.find((item) => item.id === id);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canViewMinutes) {
      return reply.code(403).send({ message: "当前账号无权使用该会议对话" });
    }

    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) {
      return reply.code(400).send({ message: "消息内容不能为空" });
    }

    try {
      const modelApiKey = await getUserAiApiKey(request.user.id);
      const result = await sendMeetingChatMessage({
        meeting,
        content,
        modelApiKey,
        userId: request.user.id
      });
      await recordAuditLog({
        actor: request.user,
        action: "chat.message_send",
        resourceType: "chat",
        resourceId: meeting.id,
        summary: `发送会议对话：${content.slice(0, 48)}${content.length > 48 ? "…" : ""}`,
        meeting,
        metadata: { messageId: result.userMessage.id }
      });
      return {
        items: [result.userMessage, result.assistantMessage],
        message: "回复已生成"
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "对话生成失败";
      return reply.code(message.includes("未配置") ? 503 : 500).send({ message });
    }
  });

  app.delete("/api/meetings/:id/chat/messages", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((item) => item.id === id);
    if (!meeting) {
      return reply.code(404).send({ message: "未找到对应会议" });
    }

    const permissions = buildPermissions(request.user, meeting);
    if (!permissions.canEdit) {
      return reply.code(403).send({ message: "当前账号无权清空该会议对话" });
    }

    await resetMeetingChat(id);
    await recordAuditLog({
      actor: request.user,
      action: "chat.reset",
      resourceType: "chat",
      resourceId: meeting.id,
      summary: `清空会议「${meeting.title}」对话`,
      meeting
    });
    return { message: "对话已清空" };
  });
}

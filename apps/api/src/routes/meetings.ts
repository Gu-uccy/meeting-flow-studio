import type { FastifyInstance, FastifyRequest } from "fastify";
import { createMeetingSchema, updateMeetingSchema, updateMeetingStatusSchema, meetingIntakeSchema, meetingStatusLabels, defaultWorkflowBlueprint } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import {
  buildMeetingSummary, normalizeStatus, createMeetingRecord, validateMeetingInput,
  updateMeetingRecord, attachPermissions, attachPermissionsToItems, sortByUpdatedAtDesc,
} from "../lib/context.js";
import { authenticate } from "../routes/auth.js";
import { saveMeetings } from "../meetingStore.js";
import { syncGoogleCalendarEvent } from "../services/googleCalendar.js";
import { syncFeishuCalendarEvent } from "../services/feishuCalendar.js";
import type { MeetingRecord } from "@meeting-flow/shared";

export async function meetingRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/meetings", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const status = normalizeStatus((request.query as { status?: string }).status);
    const filtered = status === "all" ? ctx.meetings : ctx.meetings.filter((m) => m.status === status);
    return { items: attachPermissionsToItems(filtered, request.user), summary: buildMeetingSummary(ctx.meetings) };
  });

  app.get("/api/meetings/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const meeting = ctx.meetings.find((m) => m.id === (request.params as { id: string }).id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });
    return { meeting: attachPermissions(meeting, request.user) };
  });

  app.post("/api/meetings", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const payload = createMeetingSchema.safeParse(request.body);
    if (!payload.success) return reply.code(400).send({ message: "会议创建参数不合法", issues: payload.error.flatten() });
    const validationMessage = validateMeetingInput(payload.data);
    if (validationMessage) return reply.code(400).send({ message: validationMessage });

    const meeting = createMeetingRecord(payload.data, request.user?.id);
    ctx.meetings = [meeting, ...ctx.meetings].sort(sortByUpdatedAtDesc);
    await saveMeetings(ctx.meetings);

    return reply.code(201).send({
      meeting: attachPermissions(meeting, request.user),
      summary: buildMeetingSummary(ctx.meetings),
      message: payload.data.submissionMode === "save" ? "会议已保存为草稿" : "会议已提交申请",
    });
  });

  app.put("/api/meetings/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const payload = updateMeetingSchema.safeParse(request.body);
    if (!payload.success) return reply.code(400).send({ message: "会议更新参数不合法", issues: payload.error.flatten() });
    const validationMessage = validateMeetingInput(payload.data);
    if (validationMessage) return reply.code(400).send({ message: validationMessage });

    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((m) => m.id === id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });

    const updated = updateMeetingRecord(meeting, payload.data);
    ctx.meetings = ctx.meetings.map((m) => (m.id === id ? updated : m)).sort(sortByUpdatedAtDesc);
    await saveMeetings(ctx.meetings);

    return { meeting: attachPermissions(updated, request.user), summary: buildMeetingSummary(ctx.meetings), message: "会议信息已更新" };
  });

  app.patch("/api/meetings/:id/status", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const payload = updateMeetingStatusSchema.safeParse(request.body);
    if (!payload.success) return reply.code(400).send({ message: "会议状态参数不合法", issues: payload.error.flatten() });

    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((m) => m.id === id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });

    const updated: MeetingRecord = { ...meeting, status: payload.data.status, updatedAt: new Date().toISOString(), submittedAt: payload.data.status === "draft" ? meeting.submittedAt : meeting.submittedAt || new Date().toISOString() };
    ctx.meetings = ctx.meetings.map((m) => (m.id === id ? updated : m)).sort(sortByUpdatedAtDesc);
    await saveMeetings(ctx.meetings);

    return { meeting: attachPermissions(updated, request.user), summary: buildMeetingSummary(ctx.meetings), message: `会议状态已更新为${meetingStatusLabels[payload.data.status]}` };
  });

  app.delete("/api/meetings/:id", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((m) => m.id === id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });

    ctx.meetings = ctx.meetings.filter((m) => m.id !== id);
    await saveMeetings(ctx.meetings);
    return { deletedId: id, summary: buildMeetingSummary(ctx.meetings), message: "会议已删除" };
  });

  app.post("/api/meetings/:id/sync-google-calendar", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((m) => m.id === id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });

    try {
      const externalCalendar = await syncGoogleCalendarEvent(request.user.id, meeting);
      const updated: MeetingRecord = { ...meeting, externalCalendar, meetingLink: externalCalendar.hangoutLink || meeting.meetingLink, updatedAt: new Date().toISOString() };
      ctx.meetings = ctx.meetings.map((m) => (m.id === id ? updated : m)).sort(sortByUpdatedAtDesc);
      await saveMeetings(ctx.meetings);

      return { meeting: attachPermissions(updated, request.user), summary: buildMeetingSummary(ctx.meetings), message: externalCalendar.provider === "mock" ? "已生成模拟日历事件，会议流程可以先跑通" : externalCalendar.hangoutLink ? "已同步到 Google Calendar，并生成 Google Meet 链接" : "已同步到 Google Calendar" };
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Google Calendar 同步失败" });
    }
  });

  app.post("/api/meetings/:id/sync-feishu-calendar", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const id = (request.params as { id: string }).id;
    const meeting = ctx.meetings.find((m) => m.id === id);
    if (!meeting) return reply.code(404).send({ message: "未找到对应会议" });

    try {
      const externalCalendar = await syncFeishuCalendarEvent(request.user.id, meeting);
      const updated: MeetingRecord = { ...meeting, externalCalendar, updatedAt: new Date().toISOString() };
      ctx.meetings = ctx.meetings.map((m) => (m.id === id ? updated : m)).sort(sortByUpdatedAtDesc);
      await saveMeetings(ctx.meetings);

      return { meeting: attachPermissions(updated, request.user), summary: buildMeetingSummary(ctx.meetings), message: externalCalendar.provider === "mock" ? "已生成飞书模拟日程，会议流程可以先跑通" : "已同步到飞书日历" };
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "飞书日历同步失败" });
    }
  });

  app.post("/api/meetings/intake", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const payload = meetingIntakeSchema.safeParse(request.body);
    if (!payload.success) return reply.code(400).send({ message: "会议申请参数不合法", issues: payload.error.flatten() });
    const { title, participants, meetingGoal, channel } = payload.data;
    return {
      workflowId: defaultWorkflowBlueprint.id,
      meeting: { title, attendeeCount: participants.length, channel },
      recommendations: ["建议先生成包含时间分配的精简议程。", "建议提前确认主持人、记录人和关键决策人是否到位。", "建议会后自动生成待办并同步给责任人。"],
      confidence: participants.length > 12 ? "需要复核" : "自动通过",
      summary: `会议申请已受理：${title}。会议目标：${meetingGoal}`,
    };
  });
}

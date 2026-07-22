import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken, registerWithRole, createTestMeeting } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

describe("Meetings API", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("GET /api/meetings returns empty list initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/meetings",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.summary).toBeDefined();
    expect(body.summary.total).toBe(0);
  });

  it("POST /api/meetings creates a meeting", async () => {
    const { meeting, statusCode } = await createTestMeeting(app, token);
    expect(statusCode).toBe(201);
    expect(meeting.title).toBe("测试会议");
    expect(meeting.status).toBe("scheduled");
    expect(meeting.permissions).toBeDefined();
  });

  it("GET /api/meetings returns created meeting", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/meetings",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = JSON.parse(res.body);
    expect(body.summary.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0].title).toBeDefined();
  });

  it("GET /api/meetings/:id returns meeting detail", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "详细查询测试" });
    const res = await app.inject({
      method: "GET",
      url: `/api/meetings/${meeting.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meeting.title).toBe("详细查询测试");
  });

  it("GET /api/meetings/:id returns 404 for missing meeting", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/meetings/nonexistent-id",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PUT /api/meetings/:id updates meeting", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "更新前" });
    const now = new Date();
    const res = await app.inject({
      method: "PUT",
      url: `/api/meetings/${meeting.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "更新后",
        type: "weekly",
        priority: "high",
        channel: "zoom",
        host: "李四",
        owner: "李四",
        description: "更新后的描述",
        meetingGoal: "测试会议更新功能",
        location: "会议室 B",
        meetingLink: "",
        startAt: new Date(now.getTime() + 7200000).toISOString(),
        endAt: new Date(now.getTime() + 10800000).toISOString(),
        isRecurring: false,
        recurrence: "",
        participants: [{ name: "李四", role: "host", status: "accepted" }],
        agendaItems: [{ title: "新议程", completed: false }],
        actionItems: [],
        tags: ["update"],
        status: "scheduled",
        notes: "",
        minutes: "",
        notifications: { inviteSent: false, reminderSent: false, changeNotified: false },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meeting.title).toBe("更新后");
    expect(body.meeting.priority).toBe("high");
  });

  it("PATCH /api/meetings/:id/status changes status", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "状态变更测试" });
    const res = await app.inject({
      method: "PATCH",
      url: `/api/meetings/${meeting.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "completed" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meeting.status).toBe("completed");
  });

  it("DELETE /api/meetings/:id deletes meeting", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "待删除" });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/meetings/${meeting.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deletedId).toBe(meeting.id);

    // Verify it's gone
    const getRes = await app.inject({
      method: "GET",
      url: `/api/meetings/${meeting.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it("POST /api/meetings/intake processes meeting intake", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/meetings/intake",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "需求评审",
        host: "张三",
        participants: [{ name: "张三", role: "host", status: "accepted" }],
        meetingGoal: "评审新功能需求",
        channel: "zoom",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workflowId).toBeDefined();
    expect(body.recommendations).toHaveLength(3);
    expect(body.confidence).toBeDefined();
  });

  it("Meeting endpoints require auth", async () => {
    const res = await app.inject({ method: "GET", url: "/api/meetings" });
    expect(res.statusCode).toBe(401);
  });

  describe("permission checks", () => {
    let ownerToken: string;
    let viewerToken: string;
    let otherEditorToken: string;
    let meetingId: string;

    beforeAll(async () => {
      const owner = await registerWithRole(app, "editor", undefined, "Test123456", "会议所有者");
      ownerToken = owner.token;
      const viewer = await registerWithRole(app, "viewer", undefined, "Test123456", "观察用户");
      viewerToken = viewer.token;
      const otherEditor = await registerWithRole(app, "editor", undefined, "Test123456", "其他编辑");
      otherEditorToken = otherEditor.token;

      const { meeting } = await createTestMeeting(app, ownerToken, { title: "权限测试会议" });
      meetingId = meeting.id;
    });

    it("viewer cannot create meetings", async () => {
      const { statusCode } = await createTestMeeting(app, viewerToken, { title: "viewer 创建" });
      expect(statusCode).toBe(403);
    });

    it("viewer cannot update meetings", async () => {
      const now = new Date();
      const res = await app.inject({
        method: "PUT",
        url: `/api/meetings/${meetingId}`,
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: {
          title: "viewer 更新",
          type: "weekly",
          priority: "medium",
          channel: "zoom",
          host: "张三",
          owner: "张三",
          description: "viewer 尝试更新会议",
          meetingGoal: "验证 viewer 无编辑权限",
          location: "",
          meetingLink: "",
          startAt: new Date(now.getTime() + 3600000).toISOString(),
          endAt: new Date(now.getTime() + 7200000).toISOString(),
          isRecurring: false,
          recurrence: "",
          participants: [{ name: "张三", role: "host", status: "accepted" }],
          agendaItems: [],
          actionItems: [],
          tags: [],
          status: "scheduled",
          notes: "",
          minutes: "",
          notifications: { inviteSent: false, reminderSent: false, changeNotified: false },
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it("non-owner editor can update team meetings", async () => {
      const now = new Date();
      const res = await app.inject({
        method: "PUT",
        url: `/api/meetings/${meetingId}`,
        headers: { authorization: `Bearer ${otherEditorToken}` },
        payload: {
          title: "其他编辑协作更新",
          type: "weekly",
          priority: "medium",
          channel: "zoom",
          host: "张三",
          owner: "张三",
          description: "团队编辑可维护任意会议",
          meetingGoal: "验证 editor 团队协作者模型",
          location: "",
          meetingLink: "",
          startAt: new Date(now.getTime() + 3600000).toISOString(),
          endAt: new Date(now.getTime() + 7200000).toISOString(),
          isRecurring: false,
          recurrence: "",
          participants: [{ name: "张三", role: "host", status: "accepted" }],
          agendaItems: [],
          actionItems: [],
          tags: [],
          status: "scheduled",
          notes: "",
          minutes: "",
          notifications: { inviteSent: false, reminderSent: false, changeNotified: false },
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("non-owner editor can delete team meetings", async () => {
      const { meeting: disposable } = await createTestMeeting(app, ownerToken, { title: "待协作删除" });
      const res = await app.inject({
        method: "DELETE",
        url: `/api/meetings/${disposable.id}`,
        headers: { authorization: `Bearer ${otherEditorToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it("viewer cannot delete meetings", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/meetings/${meetingId}`,
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});

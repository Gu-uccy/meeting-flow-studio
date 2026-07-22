import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken, createTestMeeting } from "../lib/testApp.js";
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
});

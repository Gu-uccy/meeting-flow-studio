import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, registerAndGetToken, registerWithRole, createTestMeeting } from "../lib/testApp.js";

describe("Memories API", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("POST /api/memories creates a manual memory for an editable meeting", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "记忆创建测试" });

    const res = await app.inject({
      method: "POST",
      url: "/api/memories",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        meetingId: meeting.id,
        content: "客户偏好周五下午开会",
        kind: "preference",
        visibility: "team"
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.memory.content).toBe("客户偏好周五下午开会");
    expect(body.memory.kind).toBe("preference");
    expect(body.memory.source).toBe("手工创建");
    expect(body.memory.sourceRunId).toBe("");
    expect(body.memory.confidence).toBe(1);
  });

  it("POST /api/memories rejects empty content", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "记忆校验" });
    const res = await app.inject({
      method: "POST",
      url: "/api/memories",
      headers: { authorization: `Bearer ${token}` },
      payload: { meetingId: meeting.id, content: "   " }
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/memories forbids viewers without edit permission", async () => {
    const { meeting } = await createTestMeeting(app, token, { title: "只读记忆测试" });
    const viewer = await registerWithRole(app, "viewer");

    const res = await app.inject({
      method: "POST",
      url: "/api/memories",
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: {
        meetingId: meeting.id,
        content: "不应创建成功"
      }
    });

    expect(res.statusCode).toBe(403);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken, createTestMeeting } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

describe("Knowledge documents API", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("uploads, lists and deletes knowledge documents", async () => {
    const { meeting } = await createTestMeeting(app, token);

    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/knowledge/documents",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        meetingId: meeting.id,
        title: "会前资料",
        content: "这是一份用于检索测试的 Markdown 文档。\n包含 OKR 复盘和风险项。",
        format: "markdown"
      }
    });
    expect(uploadRes.statusCode).toBe(201);
    const uploaded = JSON.parse(uploadRes.body) as { document: { id: string; title: string } };
    expect(uploaded.document.title).toBe("会前资料");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/knowledge/documents?meetingId=${meeting.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(listRes.statusCode).toBe(200);
    const listed = JSON.parse(listRes.body) as { items: Array<{ id: string }> };
    expect(listed.items.some((item) => item.id === uploaded.document.id)).toBe(true);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/knowledge/documents/${uploaded.document.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(deleteRes.statusCode).toBe(200);
  });

  it("seeds a demo knowledge pack for a meeting", async () => {
    const { meeting } = await createTestMeeting(app, token);

    const seedRes = await app.inject({
      method: "POST",
      url: "/api/knowledge/documents/seed-demo",
      headers: { authorization: `Bearer ${token}` },
      payload: { meetingId: meeting.id }
    });
    expect(seedRes.statusCode).toBe(200);
    const seeded = JSON.parse(seedRes.body) as { createdCount: number; items: Array<{ id: string; title: string }> };
    expect(seeded.createdCount).toBe(4);
    expect(seeded.items).toHaveLength(4);
    expect(seeded.items.some((item) => item.title === "会前背景简报")).toBe(true);

    const againRes = await app.inject({
      method: "POST",
      url: "/api/knowledge/documents/seed-demo",
      headers: { authorization: `Bearer ${token}` },
      payload: { meetingId: meeting.id }
    });
    expect(againRes.statusCode).toBe(200);
    const again = JSON.parse(againRes.body) as { createdCount: number; items: Array<{ id: string }> };
    expect(again.createdCount).toBe(0);
    expect(again.items).toHaveLength(4);
  });
});

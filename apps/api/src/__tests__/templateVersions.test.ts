import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

describe("Template versions API", () => {
  let app: FastifyInstance;
  let token: string;
  let templateId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;

    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "版本测试模板", category: "weekly" }
    });
    templateId = (JSON.parse(createRes.body) as { template: { id: string } }).template.id;
  });

  it("creates snapshot, publishes, lists and applies template versions", async () => {
    const snapshotRes = await app.inject({
      method: "POST",
      url: `/api/workflows/templates/${templateId}/versions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "snapshot", summary: "首次快照" }
    });
    expect(snapshotRes.statusCode).toBe(201);
    const snapshotBody = JSON.parse(snapshotRes.body) as { version: { id: string; version: string } };
    expect(snapshotBody.version.version).toBe("v1");

    const publishRes = await app.inject({
      method: "POST",
      url: `/api/workflows/templates/${templateId}/versions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "published", summary: "发布版本" }
    });
    expect(publishRes.statusCode).toBe(201);
    const publishBody = JSON.parse(publishRes.body) as { template: { status: string; versions: Array<{ status: string }> } };
    expect(publishBody.template.status).toBe("published");
    expect(publishBody.template.versions.filter((item) => item.status === "published")).toHaveLength(1);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/workflows/templates/${templateId}/versions`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body) as { items: Array<{ id: string }> };
    expect(listBody.items.length).toBeGreaterThanOrEqual(2);

    const canvasRes = await app.inject({
      method: "PATCH",
      url: `/api/workflows/templates/${templateId}/canvas`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nodes: [
          {
            id: "trigger-1",
            kind: "trigger",
            title: "修改后的触发器",
            description: "changed",
            position: { x: 80, y: 140 },
            owner: "system",
            inputs: [],
            outputs: ["meetingRequest"],
            configFields: []
          },
          {
            id: "ai-1",
            kind: "ai",
            title: "AI 处理",
            description: "changed",
            position: { x: 320, y: 140 },
            owner: "system",
            inputs: ["meetingRequest"],
            outputs: ["result"],
            configFields: []
          }
        ],
        edges: [{ id: "edge-trigger-ai", source: "trigger-1", target: "ai-1", label: "start" }]
      }
    });
    expect(canvasRes.statusCode).toBe(200);

    const applyRes = await app.inject({
      method: "POST",
      url: `/api/workflows/templates/${templateId}/versions/${snapshotBody.version.id}/apply`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(applyRes.statusCode).toBe(200);
    const applyBody = JSON.parse(applyRes.body) as { template: { nodes: Array<{ title: string }> } };
    expect(applyBody.template.nodes[0]?.title).toBe("会议触发");
  });
});

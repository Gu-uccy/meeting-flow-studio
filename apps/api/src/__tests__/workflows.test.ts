import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken, createTestMeeting } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

describe("Workflows API", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("GET /api/workflows/templates returns templates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].id).toBeDefined();
    expect(body.items[0].nodes).toBeDefined();
    expect(body.items[0].edges).toBeDefined();
  });

  it("GET /api/workflows/templates/:id returns specific template", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workflows/templates/template-test-001",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.template.id).toBe("template-test-001");
    expect(body.template.name).toBe("测试会议流程");
  });

  it("GET /api/workflows/templates/:id returns 404 for missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workflows/templates/nonexistent",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PATCH /api/workflows/templates/:id/canvas saves canvas", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workflows/templates/template-test-001/canvas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nodes: [
          { id: "node-1", title: "节点1", kind: "trigger", description: "", position: { x: 100, y: 100 }, owner: "system", configFields: [], inputs: [], outputs: ["event"], executor: { type: "system", label: "系统", runtime: "system", inputMapping: {}, outputMapping: {} } },
          { id: "node-2", title: "节点2", kind: "ai", description: "", position: { x: 300, y: 100 }, owner: "system", configFields: [], inputs: ["event"], outputs: ["result"], executor: { type: "aiApplication", applicationId: "app-1", label: "AI", runtime: "agent", inputMapping: {}, outputMapping: {} }, agentInputSchema: [], agentOutputSchema: [], agentPromptConfig: { systemPrompt: "", userPrompt: "", model: "claude", temperature: 0.5, maxTokens: 1024 }, agentVersions: [] },
        ],
        edges: [{ id: "edge-1", source: "node-1", target: "node-2", label: "" }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.template.nodes).toHaveLength(2);
    expect(body.template.edges).toHaveLength(1);
  });

  it("PATCH canvas rejects invalid edges", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/workflows/templates/template-test-001/canvas",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nodes: [{ id: "node-1", title: "节点1", kind: "trigger", description: "", position: { x: 100, y: 100 }, owner: "system", configFields: [], inputs: [], outputs: ["event"], executor: { type: "system", label: "系统", runtime: "system", inputMapping: {}, outputMapping: {} } }],
        edges: [{ id: "edge-1", source: "node-1", target: "nonexistent", label: "" }],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("GET /api/workflows/runs returns empty initially", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workflows/runs",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("POST /api/workflows/runs starts a workflow run", async () => {
    const { meeting } = await createTestMeeting(app, token);
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows/runs",
      headers: { authorization: `Bearer ${token}` },
      payload: { meetingId: meeting.id, templateId: "template-test-001" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.run).toBeDefined();
    expect(body.run.meetingId).toBe(meeting.id);
    expect(body.run.templateId).toBe("template-test-001");
    expect(["completed", "blocked", "running"]).toContain(body.run.status);
  });

  it("POST /api/workflows/runs returns 404 for missing meeting", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows/runs",
      headers: { authorization: `Bearer ${token}` },
      payload: { meetingId: "nonexistent" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/apps returns AI applications", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/apps",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("GET /api/workflows/schedules returns schedules", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workflows/schedules",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("POST /api/workflows/schedules creates schedule", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows/schedules",
      headers: { authorization: `Bearer ${token}` },
      payload: { templateId: "template-test-001", cronExpression: "0 9 * * 1" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.schedule).toBeDefined();
    expect(body.schedule.templateId).toBe("template-test-001");
    expect(body.schedule.cronExpression).toBe("0 9 * * 1");
  });
});

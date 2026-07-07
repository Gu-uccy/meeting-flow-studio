import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken, createTestMeeting } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

describe("Service API", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("creates service key and invokes workflow via v1 API", async () => {
    const { meeting } = await createTestMeeting(app, token);
    const appsRes = await app.inject({
      method: "GET",
      url: "/api/apps",
      headers: { authorization: `Bearer ${token}` }
    });
    const appsBody = JSON.parse(appsRes.body) as { items: Array<{ id: string; templateId: string }> };
    const application = appsBody.items[0];
    expect(application).toBeDefined();

    const keyRes = await app.inject({
      method: "POST",
      url: `/api/apps/${application!.id}/service-keys`,
      headers: { authorization: `Bearer ${token}` },
      payload: { label: "e2e-key" }
    });
    expect(keyRes.statusCode).toBe(201);
    const keyBody = JSON.parse(keyRes.body) as { key: string; serviceKey: { id: string } };
    expect(keyBody.key.startsWith("mfs_sk_")).toBe(true);

    const invokeRes = await app.inject({
      method: "POST",
      url: `/api/v1/apps/${application!.id}/run`,
      headers: { authorization: `Bearer ${keyBody.key}` },
      payload: { meetingId: meeting.id, templateId: application!.templateId }
    });
    expect(invokeRes.statusCode).toBe(202);
    const invokeBody = JSON.parse(invokeRes.body) as { run: { id: string; status: string } };
    expect(invokeBody.run.status).toBe("running");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/apps/${application!.id}/service-keys`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body) as { items: Array<{ id: string }> };
    expect(listBody.items.some((item) => item.id === keyBody.serviceKey.id)).toBe(true);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/apps/${application!.id}/service-keys/${keyBody.serviceKey.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(deleteRes.statusCode).toBe(200);
  });

  it("rejects invalid service key", async () => {
    const appsRes = await app.inject({
      method: "GET",
      url: "/api/apps",
      headers: { authorization: `Bearer ${token}` }
    });
    const application = (JSON.parse(appsRes.body) as { items: Array<{ id: string }> }).items[0];

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/apps/${application!.id}/run`,
      headers: { authorization: "Bearer mfs_sk_invalid" },
      payload: { meetingId: "missing" }
    });
    expect(res.statusCode).toBe(401);
  });
});

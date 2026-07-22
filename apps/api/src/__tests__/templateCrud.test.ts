import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

describe("Template CRUD API", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("creates, duplicates, exports, imports and deletes templates", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "P1 测试模板", category: "weekly" }
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as { template: { id: string; name: string } };
    expect(created.template.name).toBe("P1 测试模板");

    const duplicateRes = await app.inject({
      method: "POST",
      url: `/api/workflows/templates/${created.template.id}/duplicate`,
      headers: { authorization: `Bearer ${token}` },
      payload: {}
    });
    expect(duplicateRes.statusCode).toBe(201);
    const duplicated = JSON.parse(duplicateRes.body) as { template: { id: string } };
    expect(duplicated.template.id).not.toBe(created.template.id);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/workflows/templates/${created.template.id}/export`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(exportRes.statusCode).toBe(200);
    const exported = JSON.parse(exportRes.body) as { id: string; nodes: unknown[] };
    expect(exported.id).toBe(created.template.id);
    expect(Array.isArray(exported.nodes)).toBe(true);

    const importRes = await app.inject({
      method: "POST",
      url: "/api/workflows/templates/import",
      headers: { authorization: `Bearer ${token}` },
      payload: { template: { ...exported, name: "导入模板" } }
    });
    expect(importRes.statusCode).toBe(201);

    const deleteDuplicateRes = await app.inject({
      method: "DELETE",
      url: `/api/workflows/templates/${duplicated.template.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(deleteDuplicateRes.statusCode).toBe(200);

    const deleteCreatedRes = await app.inject({
      method: "DELETE",
      url: `/api/workflows/templates/${created.template.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(deleteCreatedRes.statusCode).toBe(200);
  });
});

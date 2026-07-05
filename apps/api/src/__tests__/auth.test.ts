import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, registerAndGetToken } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`;
}

describe("Auth API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("meeting-flow-api");
  });

  it("GET /api/product returns product info", async () => {
    const res = await app.inject({ method: "GET", url: "/api/product" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.product).toBeDefined();
    expect(body.product.name).toBeDefined();
  });

  it("GET /api/catalog/nodes returns node catalog", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/nodes" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("POST /api/auth/register with valid payload returns 201", async () => {
    const email = uniqueEmail("register");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "Test123456", name: "新用户" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe("editor");
  });

  it("POST /api/auth/register with duplicate email returns 409", async () => {
    const email = uniqueEmail("dup");
    // First registration
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "Test123456", name: "用户" },
    });
    // Duplicate
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "Test123456", name: "用户" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("POST /api/auth/register with invalid payload returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "bad-email" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/auth/login with valid credentials returns token", async () => {
    const email = uniqueEmail("login");
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "Test123456", name: "用户" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "Test123456" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
  });

  it("POST /api/auth/login with wrong password returns 401", async () => {
    const email = uniqueEmail("wrong");
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email, password: "Test123456", name: "用户" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "WrongPassword" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/auth/me returns user when authenticated", async () => {
    const { token } = await registerAndGetToken(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user).toBeDefined();
  });

  it("GET /api/auth/me returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});

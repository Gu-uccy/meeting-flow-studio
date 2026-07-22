import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../routes/auth.js";
import { getIntegrationAccount } from "../integrationStore.js";
import { buildGoogleAuthUrl, exchangeGoogleCode, getGoogleConfig } from "../services/googleCalendar.js";
import { buildFeishuAuthUrl, exchangeFeishuCode, getMissingFeishuCalendarScopes, getFeishuConfig } from "../services/feishuCalendar.js";

export async function integrationRoutes(app: FastifyInstance) {
  // Google
  app.get("/api/integrations/google/status", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const config = getGoogleConfig();
    const account = await getIntegrationAccount(request.user.id, "google");
    const isConnected = Boolean(account);
    return {
      provider: "google", isConfigured: config.isConfigured, isConnected, redirectUri: config.redirectUri,
      message: !config.isConfigured ? "请配置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 GOOGLE_REDIRECT_URI" : isConnected ? "Google Calendar 已连接，可以同步会议" : "Google Calendar 已配置，请连接 Google 完成用户授权",
    };
  });

  app.get("/api/integrations/google/auth-url", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const config = getGoogleConfig();
    if (!config.isConfigured) return reply.code(400).send({ message: "请先配置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 GOOGLE_REDIRECT_URI", redirectUri: config.redirectUri });
    const token = await reply.jwtSign({ sub: request.user.id, email: request.user.email, role: request.user.role }, { expiresIn: "10m" });
    return { authUrl: buildGoogleAuthUrl(token), redirectUri: config.redirectUri };
  });

  app.get("/api/integrations/google/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    if (query.error) return reply.type("text/html; charset=utf-8").send(`<p>Google 授权失败：${query.error}</p>`);
    if (!query.code || !query.state) return reply.code(400).type("text/html; charset=utf-8").send("<p>Google 授权回调缺少 code 或 state。</p>");
    try {
      const decoded = app.jwt.verify<{ sub: string }>(query.state);
      await exchangeGoogleCode(decoded.sub, query.code);
      return reply.type("text/html; charset=utf-8").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>Google Calendar 已连接</title></head><body><main style="font-family: system-ui, sans-serif; padding: 32px;"><h1>Google Calendar 已连接</h1><p>现在可以回到 Meeting Flow Studio，把会议同步到 Google 日历并生成 Google Meet 链接。</p><script>setTimeout(() => window.close(), 1200);</script></main></body></html>`);
    } catch (error) {
      return reply.code(400).type("text/html; charset=utf-8").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>Google Calendar 连接失败</title></head><body><main style="font-family: system-ui, sans-serif; padding: 32px;"><h1>Google Calendar 连接失败</h1><p>${error instanceof Error ? error.message : "授权失败，请重试。"}</p></main></body></html>`);
    }
  });

  // Feishu
  app.get("/api/integrations/feishu/status", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const config = getFeishuConfig();
    const account = await getIntegrationAccount(request.user.id, "feishu");
    const missingScopes = account ? getMissingFeishuCalendarScopes(account) : [];
    const isConnected = Boolean(account && missingScopes.length === 0);
    return {
      provider: "feishu", isConfigured: config.isConfigured, isConnected, redirectUri: config.redirectUri, calendarId: config.calendarId, missingScopes,
      message: !config.isConfigured ? "请配置 FEISHU_APP_ID、FEISHU_APP_SECRET 和 FEISHU_REDIRECT_URI" : isConnected ? "飞书日历已连接，可以同步会议" : account ? `当前飞书授权缺少日历权限，请重新连接飞书：${missingScopes.join(", ")}` : "飞书日历已配置，请连接飞书完成用户授权",
    };
  });

  app.get("/api/integrations/feishu/auth-url", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const config = getFeishuConfig();
    if (!config.isConfigured) return reply.code(400).send({ message: "请先配置 FEISHU_APP_ID、FEISHU_APP_SECRET 和 FEISHU_REDIRECT_URI", redirectUri: config.redirectUri });
    const token = await reply.jwtSign({ sub: request.user.id, email: request.user.email, role: request.user.role }, { expiresIn: "10m" });
    return { authUrl: buildFeishuAuthUrl(token), redirectUri: config.redirectUri };
  });

  app.get("/api/integrations/feishu/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string; error_description?: string };
    if (query.error) return reply.type("text/html; charset=utf-8").send(`<p>飞书授权失败：${query.error_description ?? query.error}</p>`);
    if (!query.code || !query.state) return reply.code(400).type("text/html; charset=utf-8").send("<p>飞书授权回调缺少 code 或 state。</p>");
    try {
      const decoded = app.jwt.verify<{ sub: string }>(query.state);
      await exchangeFeishuCode(decoded.sub, query.code);
      return reply.type("text/html; charset=utf-8").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>飞书日历已连接</title></head><body><main style="font-family: system-ui, sans-serif; padding: 32px;"><h1>飞书日历已连接</h1><p>现在可以回到 Meeting Flow Studio，把会议同步到飞书日历。</p><script>setTimeout(() => window.close(), 1200);</script></main></body></html>`);
    } catch (error) {
      return reply.code(400).type("text/html; charset=utf-8").send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>飞书日历连接失败</title></head><body><main style="font-family: system-ui, sans-serif; padding: 32px;"><h1>飞书日历连接失败</h1><p>${error instanceof Error ? error.message : "授权失败，请重试。"}</p></main></body></html>`);
    }
  });
}

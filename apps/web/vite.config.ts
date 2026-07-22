import type { ServerResponse } from "node:http";
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

function withProxyErrorJson(proxy: ProxyOptions): ProxyOptions {
  return {
    ...proxy,
    configure(proxyServer) {
      proxyServer.on("error", (_error, _req, res) => {
        const response = res as ServerResponse | undefined;
        if (!response || response.headersSent || typeof response.writeHead !== "function") {
          return;
        }

        response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: "后端服务暂时不可用，请稍后重试" }));
      });
    }
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": withProxyErrorJson({
        target: "http://127.0.0.1:8787",
        ws: true
      }),
      "/health": withProxyErrorJson({
        target: "http://127.0.0.1:8787"
      })
    }
  }
});

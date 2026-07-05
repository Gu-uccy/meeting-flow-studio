import type { FastifyInstance } from "fastify";
import { meetingFlowProduct, meetingNodeCatalog, miniDifyNodeCapabilityCatalog, defaultWorkflowBlueprint } from "@meeting-flow/shared";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "meeting-flow-api" }));
  app.get("/api/product", async () => ({ product: meetingFlowProduct }));
  app.get("/api/catalog/nodes", async () => ({ items: meetingNodeCatalog }));
  app.get("/api/catalog/node-capabilities", async () => ({ items: miniDifyNodeCapabilityCatalog }));
  app.get("/api/workflows/default", async () => ({ workflow: defaultWorkflowBlueprint }));
}

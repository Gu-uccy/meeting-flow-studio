import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  defaultWorkflowBlueprint,
  meetingIntakeSchema,
  meetingNodeCatalog
} from "@meeting-flow/shared";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

app.get("/health", async () => ({
  status: "ok",
  service: "meeting-flow-api"
}));

app.get("/api/catalog/nodes", async () => ({
  items: meetingNodeCatalog
}));

app.get("/api/workflows/default", async () => ({
  workflow: defaultWorkflowBlueprint
}));

app.post("/api/meetings/intake", async (request, reply) => {
  const payload = meetingIntakeSchema.safeParse(request.body);

  if (!payload.success) {
    return reply.code(400).send({
      message: "Invalid meeting intake payload",
      issues: payload.error.flatten()
    });
  }

  const { title, attendeeCount, meetingGoal, channel } = payload.data;

  return {
    workflowId: defaultWorkflowBlueprint.id,
    meeting: {
      title,
      attendeeCount,
      channel
    },
    recommendations: [
      "Generate a concise agenda with timeboxes.",
      "Prepare a decision log template before the call.",
      "Create follow-up tasks automatically after the meeting."
    ],
    confidence: attendeeCount > 12 ? "requires-review" : "auto-approved",
    summary: `Meeting intake accepted for "${title}". Goal: ${meetingGoal}`
  };
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
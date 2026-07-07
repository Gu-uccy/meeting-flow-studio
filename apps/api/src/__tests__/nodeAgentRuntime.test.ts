import { describe, expect, it } from "vitest";
import type { AiApplicationVersion, ProductWorkflowNode } from "@meeting-flow/shared";
import { demotePublishedVersions, resolvePublishedNodeRuntime } from "../services/nodeAgentRuntime.js";

const baseNode: ProductWorkflowNode = {
  id: "agenda",
  kind: "ai",
  title: "草稿节点",
  description: "",
  owner: "ops",
  position: { x: 0, y: 0 },
  inputs: [],
  outputs: [],
  configFields: [],
  agentPromptConfig: {
    model: "claude-sonnet-4",
    temperature: 0.5,
    maxTokens: 1024,
    systemPrompt: "draft system",
    userPrompt: "draft user"
  },
  agentOutputSchema: [{ key: "draftField", label: "Draft", type: "text", description: "" }]
};

const publishedVersion: AiApplicationVersion = {
  id: "version-published",
  version: "v2",
  applicationId: "app-test",
  templateId: "template-test",
  nodeId: "agenda",
  name: "发布版",
  status: "published",
  summary: "published",
  createdBy: "tester",
  createdAt: "2026-06-01T00:00:00.000Z",
  inputSchema: [],
  outputSchema: [{ key: "publishedField", label: "Published", type: "text", description: "" }],
  promptConfig: {
    model: "claude-sonnet-4",
    temperature: 0.2,
    maxTokens: 512,
    systemPrompt: "published system",
    userPrompt: "published user"
  },
  executor: {
    type: "aiApplication",
    applicationId: "app-test",
    label: "节点智能体",
    runtime: "agent",
    inputMapping: {},
    outputMapping: { publishedField: "meeting.notes" }
  }
};

describe("nodeAgentRuntime", () => {
  it("uses published version config at runtime instead of draft node fields", () => {
    const resolved = resolvePublishedNodeRuntime({
      ...baseNode,
      agentVersions: [publishedVersion]
    });

    expect(resolved.publishedVersion?.id).toBe("version-published");
    expect(resolved.node.agentPromptConfig?.userPrompt).toBe("published user");
    expect(resolved.node.agentOutputSchema?.[0]?.key).toBe("publishedField");
    expect(resolved.node.executor?.outputMapping.publishedField).toBe("meeting.notes");
  });

  it("demotes previous published versions when a new version is published", () => {
    const previousPublished = { ...publishedVersion, id: "version-old", version: "v1" };
    const next = demotePublishedVersions([previousPublished], publishedVersion.id);

    expect(next[0]?.status).toBe("snapshot");
  });
});

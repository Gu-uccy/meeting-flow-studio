import { describe, it, expect } from "vitest";
import { buildVersionDiffRows, countVersionChanges } from "./versionDiff";
import type { AiApplicationVersion } from "@meeting-flow/shared";

const baseVersion = {
  id: "v1",
  version: "v1.0.0",
  applicationId: "app-1",
  templateId: "template-1",
  nodeId: "node-1",
  name: "测试节点",
  status: "published",
  summary: "初始版本",
  createdBy: "测试用户",
  createdAt: "2026-07-06T10:00:00.000Z",
  inputSchema: [{ key: "meetingId", label: "会议 ID", type: "text", required: true, description: "", defaultValue: "" }],
  outputSchema: [{ key: "result", label: "结果", type: "json", description: "" }],
  promptConfig: {
    systemPrompt: "system-a",
    userPrompt: "user-a",
    model: "claude-sonnet-4",
    temperature: 0.5,
    maxTokens: 1024
  },
  executor: { type: "aiApplication", label: "节点智能体", runtime: "agent", inputMapping: {}, outputMapping: {} }
} satisfies AiApplicationVersion;

describe("versionDiff", () => {
  it("detects prompt and schema changes between versions", () => {
    const targetVersion: AiApplicationVersion = {
      ...baseVersion,
      id: "v2",
      version: "v1.0.1",
      promptConfig: {
        ...baseVersion.promptConfig,
        userPrompt: "user-b"
      },
      outputSchema: [
        ...baseVersion.outputSchema,
        { key: "summary", label: "摘要", type: "text", description: "" }
      ]
    };

    const rows = buildVersionDiffRows(baseVersion, targetVersion);
    expect(countVersionChanges(rows)).toBe(2);
    expect(rows.find((row) => row.label === "User Prompt")?.changed).toBe(true);
    expect(rows.find((row) => row.label === "Output Schema")?.changed).toBe(true);
  });
});

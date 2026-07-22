import { describe, expect, it } from "vitest";
import type { ProductWorkflowTemplateVersion } from "@meeting-flow/shared";
import { buildTemplateVersionDiffRows, countTemplateVersionChanges } from "./templateVersionDiff";

const baseVersion: ProductWorkflowTemplateVersion = {
  id: "version-1",
  version: "v1",
  templateId: "template-1",
  name: "周会流程",
  description: "基础模板",
  category: "weekly",
  status: "snapshot",
  templateStatus: "draft",
  summary: "初始快照",
  createdBy: "测试用户",
  createdAt: "2026-07-07T00:00:00.000Z",
  nodes: [
    {
      id: "ai-1",
      kind: "ai",
      title: "AI 节点",
      description: "",
      position: { x: 0, y: 0 },
      owner: "system",
      inputs: [],
      outputs: [],
      configFields: [{ key: "model", label: "模型", value: "claude", kind: "select" }]
    }
  ],
  edges: []
};

describe("templateVersionDiff", () => {
  it("detects template graph changes", () => {
    const targetVersion: ProductWorkflowTemplateVersion = {
      ...baseVersion,
      id: "version-2",
      version: "v2",
      nodes: [
        ...baseVersion.nodes,
        {
          id: "action-1",
          kind: "action",
          title: "动作节点",
          description: "",
          position: { x: 100, y: 0 },
          owner: "system",
          inputs: [],
          outputs: [],
          configFields: []
        }
      ],
      edges: [{ id: "edge-1", source: "ai-1", target: "action-1", label: "next" }]
    };

    const rows = buildTemplateVersionDiffRows(baseVersion, targetVersion);
    expect(countTemplateVersionChanges(rows)).toBeGreaterThan(0);
    expect(rows.find((row) => row.label === "节点数")?.changed).toBe(true);
  });
});

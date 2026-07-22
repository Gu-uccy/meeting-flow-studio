import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_ID,
  type MeetingRecord,
  type ProductWorkflowNode,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import {
  buildDroppedNode,
  formatDataMapping,
  formatList,
  formatPayload,
  getConfigDriftCount,
  getEdgeState,
  getFallbackRun,
  getFeaturedNodeId,
  getNextMeetingStatus,
  getRunConfigSnapshot,
  getTemplateForMeeting,
  parseDataMapping,
  parseList
} from "./workflowPanelUtils";

function makeNode(id: string, overrides: Partial<ProductWorkflowNode> = {}): ProductWorkflowNode {
  return {
    id,
    kind: "action",
    title: `Node ${id}`,
    description: "",
    position: { x: 0, y: 0 },
    owner: "",
    inputs: ["input"],
    outputs: ["output"],
    configFields: [{ key: "instruction", label: "执行说明", value: "", kind: "textarea" }],
    ...overrides
  };
}

function makeTemplate(id: string, category: ProductWorkflowTemplate["category"], nodeIds: string[]): ProductWorkflowTemplate {
  return {
    id,
    name: id,
    description: "",
    category,
    status: "published",
    workspaceId: DEFAULT_WORKSPACE_ID,
    nodes: nodeIds.map((nodeId, index) => makeNode(nodeId, { position: { x: index * 100, y: 0 } })),
    edges: [],
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function makeRun(
  id: string,
  templateId: string,
  meetingId: string,
  nodeRuns: ProductWorkflowRun["nodeRuns"]
): ProductWorkflowRun {
  return {
    id,
    templateId,
    meetingId,
    name: id,
    status: "running",
    durationSeconds: 0,
    startedAt: "2026-01-01T00:00:00.000Z",
    nodeRuns,
    logs: []
  };
}

function makeMeeting(type: MeetingRecord["type"], status: MeetingRecord["status"] = "draft"): MeetingRecord {
  return { type, status } as MeetingRecord;
}

describe("getFallbackRun", () => {
  const runs = [
    makeRun("run-a", "tpl-1", "meeting-a", []),
    makeRun("run-b", "tpl-1", "meeting-b", []),
    makeRun("run-c", "tpl-2", "meeting-a", [])
  ];

  it("prefers a run matching both template and meeting", () => {
    expect(getFallbackRun(runs, "tpl-1", "meeting-b")?.id).toBe("run-b");
  });

  it("falls back to any run for the template when meeting is missing", () => {
    expect(getFallbackRun(runs, "tpl-1", null)?.id).toBe("run-a");
  });

  it("returns null when no run exists for the template", () => {
    expect(getFallbackRun(runs, "tpl-missing", "meeting-a")).toBeNull();
  });
});

describe("getEdgeState", () => {
  const run = makeRun("run-1", "tpl-1", "meeting-1", [
    { nodeId: "a", status: "success" },
    { nodeId: "b", status: "running" },
    { nodeId: "c", status: "blocked" }
  ]);

  it("returns blocked when source or target is blocked or failed", () => {
    expect(getEdgeState("a", "c", run)).toBe("blocked");
  });

  it("returns running when either side is running", () => {
    expect(getEdgeState("a", "b", run)).toBe("running");
  });

  it("returns done when both sides succeeded", () => {
    const completedRun = makeRun("run-2", "tpl-1", "meeting-1", [
      { nodeId: "a", status: "success" },
      { nodeId: "b", status: "success" }
    ]);
    expect(getEdgeState("a", "b", completedRun)).toBe("done");
  });

  it("returns optional when target is skipped", () => {
    const skippedRun = makeRun("run-3", "tpl-1", "meeting-1", [
      { nodeId: "a", status: "success" },
      { nodeId: "b", status: "skipped" }
    ]);
    expect(getEdgeState("a", "b", skippedRun)).toBe("optional");
  });

  it("returns waiting when run is missing", () => {
    expect(getEdgeState("a", "b", null)).toBe("waiting");
  });
});

describe("getTemplateForMeeting", () => {
  const templates = [
    makeTemplate("weekly-tpl", "weekly", ["n1"]),
    makeTemplate("project-tpl", "project", ["n2"])
  ];

  it("matches template category to meeting type", () => {
    expect(getTemplateForMeeting(templates, makeMeeting("project"))?.id).toBe("project-tpl");
  });

  it("falls back to the first template when no category matches", () => {
    expect(getTemplateForMeeting(templates, makeMeeting("interview"))?.id).toBe("weekly-tpl");
  });

  it("returns the first template when meeting is null", () => {
    expect(getTemplateForMeeting(templates, null)?.id).toBe("weekly-tpl");
  });
});

describe("getNextMeetingStatus", () => {
  it("advances draft to scheduled", () => {
    expect(getNextMeetingStatus("draft")).toEqual({ label: "提交会议", value: "scheduled" });
  });

  it("advances scheduled to in_progress", () => {
    expect(getNextMeetingStatus("scheduled")).toEqual({ label: "开始会议", value: "in_progress" });
  });

  it("advances in_progress to completed", () => {
    expect(getNextMeetingStatus("in_progress")).toEqual({ label: "标记完成", value: "completed" });
  });

  it("returns null for terminal statuses", () => {
    expect(getNextMeetingStatus("completed")).toBeNull();
    expect(getNextMeetingStatus("cancelled")).toBeNull();
  });
});

describe("getFeaturedNodeId", () => {
  const template = makeTemplate("tpl-1", "weekly", ["n1", "n2", "n3"]);

  it("defaults to the second node when run is missing", () => {
    expect(getFeaturedNodeId(null, template)).toBe("n2");
  });

  it("prioritizes blocked or failed nodes", () => {
    const run = makeRun("run-1", "tpl-1", "meeting-1", [
      { nodeId: "n1", status: "success" },
      { nodeId: "n2", status: "blocked" }
    ]);
    expect(getFeaturedNodeId(run, template)).toBe("n2");
  });

  it("falls back to the last successful node", () => {
    const run = makeRun("run-2", "tpl-1", "meeting-1", [
      { nodeId: "n1", status: "success" },
      { nodeId: "n2", status: "pending" }
    ]);
    expect(getFeaturedNodeId(run, template)).toBe("n1");
  });
});

describe("formatPayload", () => {
  it("stringifies payload entries", () => {
    expect(formatPayload({ topic: "周会", count: 3 })).toEqual([
      { key: "topic", value: "周会" },
      { key: "count", value: "3" }
    ]);
  });

  it("returns an empty list for missing payload", () => {
    expect(formatPayload()).toEqual([]);
  });
});

describe("parseList and formatList", () => {
  it("splits comma and newline separated values", () => {
    expect(parseList("a, b，\nc")).toEqual(["a", "b", "c"]);
  });

  it("joins values back into a comma-separated string", () => {
    expect(formatList(["a", "b", "c"])).toBe("a, b, c");
  });
});

describe("parseDataMapping and formatDataMapping", () => {
  it("round-trips mapping lines", () => {
    const mapping = parseDataMapping("input.topic -> output.title\ninput.owner -> output.host");
    expect(mapping).toEqual({
      "input.topic": "output.title",
      "input.owner": "output.host"
    });
    expect(formatDataMapping(mapping)).toBe("input.topic -> output.title\ninput.owner -> output.host");
  });

  it("returns an empty string for empty mapping", () => {
    expect(formatDataMapping({})).toBe("");
  });
});

describe("getRunConfigSnapshot", () => {
  const template = makeTemplate("tpl-1", "weekly", ["n1"]);
  const run = makeRun("run-1", "tpl-1", "meeting-1", []);

  it("uses explicit snapshot when available", () => {
    const snapshotRun: ProductWorkflowRun = {
      ...run,
      configSnapshot: [{
        nodeId: "n1",
        nodeTitle: "快照节点",
        configFields: [{ key: "instruction", label: "执行说明", value: "快照值", kind: "textarea" }]
      }]
    };

    expect(getRunConfigSnapshot(snapshotRun, template, "n1")).toEqual({
      nodeTitle: "快照节点",
      configFields: [{ key: "instruction", label: "执行说明", value: "快照值", kind: "textarea" }]
    });
  });

  it("falls back to the current template node", () => {
    expect(getRunConfigSnapshot(run, template, "n1").nodeTitle).toBe("Node n1");
  });
});

describe("getConfigDriftCount", () => {
  it("counts fields whose values differ from the current template", () => {
    const template = makeTemplate("tpl-1", "weekly", ["n1"]);
    template.nodes[0].configFields = [
      { key: "instruction", label: "执行说明", value: "当前值", kind: "textarea" },
      { key: "model", label: "模型", value: "gpt", kind: "text" }
    ];

    const run: ProductWorkflowRun = {
      ...makeRun("run-1", "tpl-1", "meeting-1", []),
      configSnapshot: [{
        nodeId: "n1",
        nodeTitle: "Node n1",
        configFields: [
          { key: "instruction", label: "执行说明", value: "旧值", kind: "textarea" },
          { key: "model", label: "模型", value: "gpt", kind: "text" }
        ]
      }]
    };

    expect(getConfigDriftCount(run, template)).toBe(1);
  });
});

describe("buildDroppedNode", () => {
  it("creates kind-specific config fields", () => {
    const aiNode = buildDroppedNode("ai", { x: 10, y: 20 });
    expect(aiNode.kind).toBe("ai");
    expect(aiNode.title).toBe("新 AI 节点");
    expect(aiNode.configFields.some((field) => field.key === "prompt")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { seedMeetings, type ProductWorkflowRun, type ProductWorkflowTemplate } from "@meeting-flow/shared";
import { advanceWorkflowExecution } from "../services/executor.js";
import { getPathValue } from "../services/runtimeMapping.js";

const meeting = seedMeetings[0]!;

const advanceTemplate: ProductWorkflowTemplate = {
  id: "template-advance-test",
  name: "阻塞恢复测试",
  description: "验证 advance 路径会合并 runtimeStore",
  category: "weekly",
  status: "published",
  updatedAt: "2026-06-01T03:20:00.000Z",
  nodes: [
    {
      id: "intake",
      kind: "trigger",
      title: "会议触发",
      description: "",
      position: { x: 0, y: 0 },
      inputs: [],
      outputs: ["meetingRequest"],
      configFields: [],
      executor: { type: "system", label: "系统执行器", runtime: "system", inputMapping: {}, outputMapping: {} }
    },
    {
      id: "review",
      kind: "decision",
      title: "人工审批",
      description: "",
      position: { x: 200, y: 0 },
      inputs: ["meetingRequest"],
      outputs: ["routeDecision"],
      configFields: [],
      executor: { type: "manual", label: "人工处理", runtime: "human", inputMapping: {}, outputMapping: { resolutionNote: "meeting.notes" } }
    },
    {
      id: "dispatch",
      kind: "action",
      title: "会后分发",
      description: "",
      position: { x: 400, y: 0 },
      inputs: ["routeDecision"],
      outputs: ["syncStatus"],
      configFields: [{ key: "toolPreset", label: "工具预设", value: "notification", kind: "select" }],
      executor: { type: "system", label: "系统执行器", runtime: "system", inputMapping: {}, outputMapping: { syncStatus: "node.dispatch.syncStatus" } }
    }
  ],
  edges: [
    { id: "intake-review", source: "intake", target: "review", label: "request" },
    { id: "review-dispatch", source: "review", target: "dispatch", label: "approved" }
  ]
};

const blockedRun: ProductWorkflowRun = {
  id: "run-advance-test",
  templateId: advanceTemplate.id,
  meetingId: meeting.id,
  name: `${meeting.title} / 阻塞恢复测试`,
  status: "blocked",
  durationSeconds: 3,
  startedAt: "2026-06-01T03:20:00.000Z",
  nodeRuns: [
    {
      nodeId: "intake",
      status: "success",
      startedAt: "2026-06-01T03:20:01.000Z",
      endedAt: "2026-06-01T03:20:02.000Z",
      outputPayload: { meetingRequest: meeting.id }
    },
    {
      nodeId: "review",
      status: "blocked",
      startedAt: "2026-06-01T03:20:02.000Z",
      errorMessage: "等待人工审批"
    },
    {
      nodeId: "dispatch",
      status: "pending"
    }
  ],
  logs: [],
  runtimeSnapshot: {
    meeting: {
      meetingId: meeting.id,
      title: meeting.title,
      type: meeting.type,
      priority: meeting.priority,
      meetingGoal: meeting.meetingGoal,
      participants: meeting.participants.map((participant) => participant.name),
      attendeeCount: meeting.attendeeCount
    },
    node: {
      intake: { meetingRequest: meeting.id }
    }
  }
};

describe("advanceWorkflowExecution", () => {
  it("merges runtimeStore when resolving blocked nodes and continuing pending nodes", async () => {
    const advancedRun = await advanceWorkflowExecution(blockedRun, meeting, advanceTemplate, "审批通过，继续流程");

    expect(advancedRun.status).toBe("completed");
    expect(advancedRun.runtimeSnapshot).toBeDefined();
    expect(getPathValue(advancedRun.runtimeSnapshot!, "meeting.notes")).toBe("审批通过，继续流程");
    expect(advancedRun.nodeRuns.find((nodeRun) => nodeRun.nodeId === "review")?.status).toBe("success");
    expect(advancedRun.nodeRuns.find((nodeRun) => nodeRun.nodeId === "dispatch")?.status).toBe("success");
    expect(advancedRun.usage).toBeDefined();
  });

  it("rebuilds runtimeStore from completed node runs when snapshot is missing", async () => {
    const legacyRun: ProductWorkflowRun = {
      ...blockedRun,
      runtimeSnapshot: undefined,
      nodeRuns: [
        {
          nodeId: "intake",
          status: "success",
          outputPayload: { meetingRequest: meeting.id, meetingType: meeting.type }
        },
        blockedRun.nodeRuns[1]!,
        blockedRun.nodeRuns[2]!
      ]
    };

    const advancedRun = await advanceWorkflowExecution(legacyRun, meeting, advanceTemplate, "legacy run 恢复");

    expect(advancedRun.status).toBe("completed");
    expect(advancedRun.runtimeSnapshot).toBeDefined();
    expect(getPathValue(advancedRun.runtimeSnapshot!, "node.intake.meetingRequest")).toBe(meeting.id);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_ID, type ProductWorkflowRun } from "@meeting-flow/shared";
import { buildRunLatencyWaterfall, getRunLatencyAxisMarks } from "./runLatencyWaterfall";

const sampleRun: ProductWorkflowRun = {
  id: "run-waterfall-test",
  templateId: "template-test",
  meetingId: "meeting-001",
  name: "Latency 测试",
  status: "completed",
  durationSeconds: 10,
  startedAt: "2026-06-01T10:00:00.000Z",
  endedAt: "2026-06-01T10:00:10.000Z",
  nodeRuns: [
    {
      nodeId: "intake",
      status: "success",
      startedAt: "2026-06-01T10:00:00.000Z",
      endedAt: "2026-06-01T10:00:02.000Z"
    },
    {
      nodeId: "agenda",
      status: "success",
      startedAt: "2026-06-01T10:00:02.000Z",
      endedAt: "2026-06-01T10:00:06.000Z",
      outputPayload: { inputTokens: 120, outputTokens: 80 }
    },
    {
      nodeId: "dispatch",
      status: "pending"
    }
  ],
  logs: [],
  usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 }
};

describe("buildRunLatencyWaterfall", () => {
  it("builds offset and width percentages from node timestamps", () => {
    const model = buildRunLatencyWaterfall(sampleRun, {
      id: "template-test",
      name: "测试模板",
      description: "",
      category: "weekly",
      status: "published",
      workspaceId: DEFAULT_WORKSPACE_ID,
      updatedAt: "2026-06-01T00:00:00.000Z",
      nodes: [
        { id: "intake", kind: "trigger", title: "触发", description: "", owner: "ops", position: { x: 0, y: 0 }, inputs: [], outputs: [], configFields: [] },
        { id: "agenda", kind: "ai", title: "议程生成", description: "", owner: "ops", position: { x: 0, y: 0 }, inputs: [], outputs: [], configFields: [] },
        { id: "dispatch", kind: "action", title: "分发", description: "", owner: "ops", position: { x: 0, y: 0 }, inputs: [], outputs: [], configFields: [] }
      ],
      edges: []
    });

    expect(model.hasTiming).toBe(true);
    expect(model.totalMs).toBe(10000);

    const intake = model.segments.find((segment) => segment.nodeId === "intake");
    const agenda = model.segments.find((segment) => segment.nodeId === "agenda");
    const dispatch = model.segments.find((segment) => segment.nodeId === "dispatch");

    expect(intake?.offsetPercent).toBe(0);
    expect(intake?.widthPercent).toBeCloseTo(20, 0);
    expect(intake?.label).toBe("触发");
    expect(agenda?.offsetPercent).toBeCloseTo(20, 0);
    expect(agenda?.widthPercent).toBeCloseTo(40, 0);
    expect(agenda?.tokens?.total).toBe(200);
    expect(dispatch?.hasTiming).toBe(false);
    expect(dispatch?.durationLabel).toBe("未执行");
    expect(model.waves.length).toBeGreaterThan(0);
  });

  it("returns empty timing state when node timestamps are missing", () => {
    const model = buildRunLatencyWaterfall({
      ...sampleRun,
      nodeRuns: [{ nodeId: "intake", status: "success" }]
    });

    expect(model.hasTiming).toBe(false);
  });
});

describe("getRunLatencyAxisMarks", () => {
  it("includes start and end marks for short runs", () => {
    const marks = getRunLatencyAxisMarks(2500);
    expect(marks[0]?.label).toBe("0ms");
    expect(marks[marks.length - 1]?.label).toBe("2.5s");
  });
});

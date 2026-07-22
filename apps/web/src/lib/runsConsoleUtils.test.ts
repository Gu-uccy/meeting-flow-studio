import { describe, expect, it } from "vitest";
import type { ProductWorkflowRun } from "@meeting-flow/shared";
import { buildRunsConsoleStats, filterRunsConsole } from "./runsConsoleUtils";

const sampleRuns: ProductWorkflowRun[] = [
  {
    id: "run-1",
    templateId: "tpl-a",
    meetingId: "meeting-a",
    name: "周会流程",
    status: "running",
    durationSeconds: 12,
    startedAt: "2026-07-07T10:00:00.000Z",
    nodeRuns: [],
    logs: []
  },
  {
    id: "run-2",
    templateId: "tpl-b",
    meetingId: "meeting-b",
    name: "复盘流程",
    status: "blocked",
    durationSeconds: 30,
    startedAt: "2026-07-07T09:00:00.000Z",
    nodeRuns: [],
    logs: []
  },
  {
    id: "run-3",
    templateId: "tpl-a",
    meetingId: "meeting-a",
    name: "周会流程 #2",
    status: "completed",
    durationSeconds: 45,
    startedAt: "2026-07-06T08:00:00.000Z",
    nodeRuns: [],
    logs: []
  }
];

describe("runsConsoleUtils", () => {
  it("builds status stats", () => {
    expect(buildRunsConsoleStats(sampleRuns)).toEqual({
      total: 3,
      running: 1,
      blocked: 1,
      failed: 0,
      completed: 1,
      queued: 0
    });
  });

  it("filters runs by status, template, meeting and search", () => {
    const filtered = filterRunsConsole(sampleRuns, {
      status: "blocked",
      templateId: "",
      meetingId: "",
      search: ""
    });
    expect(filtered.map((run) => run.id)).toEqual(["run-2"]);

    const templateFiltered = filterRunsConsole(sampleRuns, {
      status: "all",
      templateId: "tpl-a",
      meetingId: "",
      search: "周会"
    });
    expect(templateFiltered.map((run) => run.id)).toEqual(["run-1", "run-3"]);
  });
});

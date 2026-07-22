import { describe, expect, it } from "vitest";
import { buildWorkbenchPath, parseWorkbenchPath } from "./workbenchRouting";

describe("workbenchRouting", () => {
  it("builds and parses meeting-scoped paths", () => {
    expect(buildWorkbenchPath("chat", "meeting-1")).toBe("/app/chat/meeting-1");
    expect(parseWorkbenchPath("/app/chat/meeting-1")).toEqual({
      view: "chat",
      meetingId: "meeting-1",
      nodeAgentKey: null
    });
  });

  it("builds and parses node agent deep links", () => {
    expect(buildWorkbenchPath("apps", null, "tpl-1-node-2")).toBe("/app/apps/tpl-1-node-2");
    expect(parseWorkbenchPath("/app/apps/tpl-1-node-2")).toEqual({
      view: "apps",
      meetingId: null,
      nodeAgentKey: "tpl-1-node-2"
    });
  });

  it("rejects unknown paths", () => {
    expect(parseWorkbenchPath("/")).toBeNull();
    expect(parseWorkbenchPath("/app/not-a-view")).toBeNull();
  });

  it("uses config view id and redirects legacy calendar paths", () => {
    expect(buildWorkbenchPath("config", "meeting-1")).toBe("/app/config/meeting-1");
    expect(parseWorkbenchPath("/app/config")).toEqual({
      view: "config",
      meetingId: null,
      nodeAgentKey: null
    });
    expect(parseWorkbenchPath("/app/calendar/meeting-1")).toEqual({
      view: "config",
      meetingId: "meeting-1",
      nodeAgentKey: null
    });
  });
});

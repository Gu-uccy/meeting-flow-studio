import { describe, expect, it } from "vitest";
import { extractFeishuMeetingNo } from "../services/feishuCalendar.js";
import { seedMeetings, type ProductWorkflowNode } from "@meeting-flow/shared";

// Mirror executor helpers via a thin re-test of blocking semantics using meeting.externalMeeting.
function nodeRequiresMeetingRecording(node: Pick<ProductWorkflowNode, "id" | "title" | "outputs" | "configFields">) {
  const flag = (node.configFields.find((field) => field.key === "requireRecording")?.value ?? "").trim().toLowerCase();
  if (flag === "关闭" || flag === "false" || flag === "0" || flag === "off") {
    return false;
  }
  if (flag === "开启" || flag === "true" || flag === "1" || flag === "on") {
    return true;
  }
  return node.id === "minutes" || node.outputs.includes("minutesDraft") || node.title.includes("纪要");
}

function hasReadyMeetingRecording(meeting: (typeof seedMeetings)[number]) {
  return meeting.externalMeeting?.recordingStatus === "ready";
}

describe("feishu meeting binding helpers", () => {
  it("extracts 9-digit meeting number from feishu urls", () => {
    expect(extractFeishuMeetingNo("https://vc.feishu.cn/j/123456789")).toBe("123456789");
    expect(extractFeishuMeetingNo("123456789")).toBe("123456789");
    expect(extractFeishuMeetingNo("invalid")).toBe("");
  });

  it("blocks minutes node until recording is ready", () => {
    const minutesNode = {
      id: "minutes",
      title: "整理纪要与决策",
      outputs: ["minutesDraft"],
      configFields: [{ key: "requireRecording", label: "要求录音就绪", value: "开启", kind: "toggle" as const }]
    };
    const meeting = { ...seedMeetings[0]! };

    expect(nodeRequiresMeetingRecording(minutesNode)).toBe(true);
    expect(hasReadyMeetingRecording(meeting)).toBe(false);

    const ready = {
      ...meeting,
      externalMeeting: {
        provider: "feishu" as const,
        calendarEventId: "evt-1",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingNo: "123456789",
        meetingId: "m-1",
        recordingStatus: "ready" as const,
        transcriptStatus: "pending" as const,
        recordingUrl: "https://example.com/rec",
        transcriptText: "",
        lastSyncedAt: new Date().toISOString(),
        statusMessage: "ready"
      }
    };
    expect(hasReadyMeetingRecording(ready)).toBe(true);
  });
});

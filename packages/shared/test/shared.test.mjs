import test from "node:test";
import assert from "node:assert/strict";
import {
  createMeetingSchema,
  meetingRecordSchema,
  productWorkflowTemplates,
  seedMeetings
} from "../dist/index.js";

test("seed meetings satisfy the shared meeting schema", () => {
  assert.doesNotThrow(() => meetingRecordSchema.array().parse(seedMeetings));
  assert.equal(seedMeetings.length > 0, true);
});

test("create meeting schema accepts a valid meeting request", () => {
  const parsed = createMeetingSchema.parse({
    title: "产品评审会",
    type: "review",
    tags: ["评审"],
    host: "陈晴",
    owner: "王立",
    description: "同步产品方案并确认后续行动。",
    meetingGoal: "确认产品方案是否可以进入开发排期。",
    channel: "teams",
    startAt: "2026-07-01T01:00:00.000Z",
    endAt: "2026-07-01T02:00:00.000Z",
    priority: "high",
    location: "上海 3F",
    meetingLink: "",
    isRecurring: false,
    recurrence: "",
    participants: [{ name: "陈晴", role: "host", status: "accepted" }],
    agendaItems: [{ title: "方案讲解", completed: false }],
    notes: "",
    submissionMode: "submit"
  });

  assert.equal(parsed.submissionMode, "submit");
  assert.equal(parsed.participants.length, 1);
});

test("meeting schema accepts a mock calendar sync result", () => {
  const parsed = meetingRecordSchema.parse({
    ...seedMeetings[0],
    externalCalendar: {
      provider: "mock",
      eventId: "mock-meeting-001",
      htmlLink: "",
      hangoutLink: "",
      syncedAt: "2026-07-02T00:00:00.000Z"
    }
  });

  assert.equal(parsed.externalCalendar.provider, "mock");
});

test("meeting schema accepts a Feishu calendar sync result", () => {
  const parsed = meetingRecordSchema.parse({
    ...seedMeetings[0],
    externalCalendar: {
      provider: "feishu",
      eventId: "feishu-event-001",
      htmlLink: "https://applink.feishu.cn/client/calendar/event",
      hangoutLink: "",
      syncedAt: "2026-07-02T00:00:00.000Z"
    }
  });

  assert.equal(parsed.externalCalendar.provider, "feishu");
});

test("workflow templates only connect existing nodes", () => {
  for (const template of productWorkflowTemplates) {
    const nodeIds = new Set(template.nodes.map((node) => node.id));

    for (const edge of template.edges) {
      assert.equal(nodeIds.has(edge.source), true, `${template.id} has unknown source ${edge.source}`);
      assert.equal(nodeIds.has(edge.target), true, `${template.id} has unknown target ${edge.target}`);
    }
  }
});

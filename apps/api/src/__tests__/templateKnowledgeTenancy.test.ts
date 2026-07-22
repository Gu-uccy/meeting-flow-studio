import { describe, it, expect, beforeAll } from "vitest";
import { DEFAULT_WORKSPACE_ID } from "@meeting-flow/shared";
import { buildTestApp, registerWithRole, createTestMeeting } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

const OTHER_WORKSPACE_ID = "workspace-tenancy-other-001";

describe("Template and knowledge workspace tenancy", () => {
  let app: FastifyInstance;
  let defaultEditorToken: string;
  let otherEditorToken: string;
  let defaultMeetingId: string;
  let otherMeetingId: string;
  let defaultTemplateId: string;
  let otherTemplateId: string;

  beforeAll(async () => {
    app = await buildTestApp();

    const defaultEditor = await registerWithRole(app, "editor", undefined, "Test123456", "默认区编辑");
    defaultEditorToken = defaultEditor.token;

    const otherEditor = await registerWithRole(app, "editor", undefined, "Test123456", "外区编辑", OTHER_WORKSPACE_ID);
    otherEditorToken = otherEditor.token;

    const defaultMeeting = await createTestMeeting(app, defaultEditorToken, { title: "默认区会议" });
    defaultMeetingId = defaultMeeting.meeting.id;

    const otherMeeting = await createTestMeeting(app, otherEditorToken, { title: "外区会议" });
    otherMeetingId = otherMeeting.meeting.id;

    const defaultTemplates = await app.inject({
      method: "GET",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${defaultEditorToken}` }
    });
    expect(defaultTemplates.statusCode).toBe(200);
    defaultTemplateId = JSON.parse(defaultTemplates.body).items[0].id;

    const createOtherTemplate = await app.inject({
      method: "POST",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${otherEditorToken}` },
      payload: { name: "外区专用模板", category: "weekly" }
    });
    expect(createOtherTemplate.statusCode).toBe(201);
    otherTemplateId = JSON.parse(createOtherTemplate.body).template.id;
    expect(JSON.parse(createOtherTemplate.body).template.workspaceId).toBe(OTHER_WORKSPACE_ID);
  });

  it("lists only templates in the active workspace", async () => {
    const defaultList = await app.inject({
      method: "GET",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${defaultEditorToken}` }
    });
    const defaultItems = JSON.parse(defaultList.body).items as Array<{ id: string; workspaceId: string }>;
    expect(defaultItems.every((item) => item.workspaceId === DEFAULT_WORKSPACE_ID)).toBe(true);
    expect(defaultItems.some((item) => item.id === otherTemplateId)).toBe(false);

    const otherList = await app.inject({
      method: "GET",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${otherEditorToken}` }
    });
    const otherItems = JSON.parse(otherList.body).items as Array<{ id: string; workspaceId: string }>;
    expect(otherItems.some((item) => item.id === otherTemplateId)).toBe(true);
    expect(otherItems.every((item) => item.workspaceId === OTHER_WORKSPACE_ID)).toBe(true);
  });

  it("denies cross-workspace template access", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/workflows/templates/${otherTemplateId}`,
      headers: { authorization: `Bearer ${defaultEditorToken}` }
    });
    expect(res.statusCode).toBe(403);
  });

  it("stamps new templates with the active workspace", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows/templates",
      headers: { authorization: `Bearer ${defaultEditorToken}` },
      payload: { name: "默认区新建模板" }
    });
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).template.workspaceId).toBe(DEFAULT_WORKSPACE_ID);
  });

  it("denies knowledge document listing for meetings outside active workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/knowledge/documents?meetingId=${otherMeetingId}`,
      headers: { authorization: `Bearer ${defaultEditorToken}` }
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows knowledge document listing for meetings in active workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/knowledge/documents?meetingId=${defaultMeetingId}`,
      headers: { authorization: `Bearer ${defaultEditorToken}` }
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.body).items)).toBe(true);
  });

  it("cannot start a run with a template from another workspace", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows/runs",
      headers: { authorization: `Bearer ${defaultEditorToken}` },
      payload: { meetingId: defaultMeetingId, templateId: otherTemplateId }
    });
    expect(res.statusCode).toBe(404);
  });

  it("can start a run with a template from the same workspace", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows/runs",
      headers: { authorization: `Bearer ${defaultEditorToken}` },
      payload: { meetingId: defaultMeetingId, templateId: defaultTemplateId }
    });
    expect(res.statusCode).toBe(201);
  });
});

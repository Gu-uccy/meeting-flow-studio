import { describe, it, expect, beforeAll } from "vitest";
import { DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID } from "@meeting-flow/shared";
import { buildTestApp, registerWithRole, createTestMeeting } from "../lib/testApp.js";
import type { FastifyInstance } from "fastify";

const OTHER_WORKSPACE_ID = "workspace-other-001";

describe("Workspace and audit APIs", () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let outsiderToken: string;
  let meetingId: string;
  let managedWorkspaceId: string;
  let managerToken: string;
  let managerUserId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const owner = await registerWithRole(app, "editor", undefined, "Test123456", "工作区A编辑");
    ownerToken = owner.token;
    const outsider = await registerWithRole(app, "editor", undefined, "Test123456", "工作区B编辑", OTHER_WORKSPACE_ID);
    outsiderToken = outsider.token;

    const { meeting } = await createTestMeeting(app, ownerToken, { title: "工作区隔离测试" });
    meetingId = meeting.id;

    const manager = await registerWithRole(app, "editor", undefined, "Test123456", "工作区管理员");
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers: { authorization: `Bearer ${manager.token}` },
      payload: { name: "RBAC 管理区" }
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    managedWorkspaceId = createBody.workspace.id;
    managerToken = createBody.token;
    managerUserId = createBody.user.id;
  });

  it("GET /api/workspaces/current returns active workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workspaces/current",
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workspace.id).toBe("workspace-default-001");
    expect(body.workspace.name).toBe("默认工作区");
  });

  it("GET /api/workspaces lists accessible workspaces", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/workspaces",
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items.some((item: { id: string }) => item.id === TEAM_B_WORKSPACE_ID)).toBe(true);
    expect(body.activeWorkspaceId).toBe("workspace-default-001");
  });

  it("PATCH /api/auth/me/workspace switches active workspace", async () => {
    const multiWorkspaceEditor = await registerWithRole(app, "editor", undefined, "Test123456", "多工作区编辑");
    const switchRes = await app.inject({
      method: "PATCH",
      url: "/api/auth/me/workspace",
      headers: { authorization: `Bearer ${multiWorkspaceEditor.token}` },
      payload: { workspaceId: TEAM_B_WORKSPACE_ID }
    });
    expect(switchRes.statusCode).toBe(200);
    const switchBody = JSON.parse(switchRes.body);
    expect(switchBody.user.workspaceId).toBe(TEAM_B_WORKSPACE_ID);
    expect(switchBody.effectiveRole).toBe("editor");
    expect(switchBody.token).toBeDefined();

    const meRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${switchBody.token}` }
    });
    const meBody = JSON.parse(meRes.body);
    expect(meBody.user.workspaceId).toBe(TEAM_B_WORKSPACE_ID);
    expect(meBody.effectiveRole).toBe("editor");
  });

  it("PATCH /api/auth/me/workspace rejects inaccessible workspace", async () => {
    const viewer = await registerWithRole(app, "viewer");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me/workspace",
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { workspaceId: TEAM_B_WORKSPACE_ID }
    });
    expect(res.statusCode).toBe(403);
  });

  it("POST /api/workspaces creates workspace and switches active context as admin", async () => {
    const editor = await registerWithRole(app, "editor", undefined, "Test123456", "创建者");
    const res = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { name: "客户成功团队" }
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.workspace.name).toBe("客户成功团队");
    expect(body.user.workspaceId).toBe(body.workspace.id);
    expect(body.user.effectiveRole).toBe("admin");
    expect(body.effectiveRole).toBe("admin");
    expect(body.token).toBeDefined();
    expect(body.user.workspaceIds).toContain(body.workspace.id);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/workspaces",
      headers: { authorization: `Bearer ${body.token}` }
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.items.some((item: { id: string }) => item.id === body.workspace.id)).toBe(true);
    expect(listBody.activeWorkspaceId).toBe(body.workspace.id);
  });

  it("POST /api/workspaces rejects viewer", async () => {
    const viewer = await registerWithRole(app, "viewer");
    const res = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { name: "观察团队" }
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /api/workspaces/:id/members lists workspace members for admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/workspaces/${managedWorkspaceId}/members`,
      headers: { authorization: `Bearer ${managerToken}` }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((item: { memberRole: string }) => item.memberRole === "admin")).toBe(true);
  });

  it("non-admin cannot invite members on default workspace", async () => {
    const editor = await registerWithRole(app, "editor", undefined, "Test123456", "普通编辑");
    const invitee = await registerWithRole(app, "editor", undefined, "Test123456", "不能被邀请", OTHER_WORKSPACE_ID);
    const res = await app.inject({
      method: "POST",
      url: `/api/workspaces/${DEFAULT_WORKSPACE_ID}/members`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: invitee.user.email, role: "editor" }
    });
    expect(res.statusCode).toBe(403);
  });

  it("GET /api/workspaces/:id/members allows any workspace member", async () => {
    const editor = await registerWithRole(app, "editor", undefined, "Test123456", "成员列表编辑");
    const res = await app.inject({
      method: "GET",
      url: `/api/workspaces/${DEFAULT_WORKSPACE_ID}/members`,
      headers: { authorization: `Bearer ${editor.token}` }
    });
    expect(res.statusCode).toBe(200);
  });

  it("POST /api/workspaces/:id/members invites existing user with role", async () => {
    const invitee = await registerWithRole(app, "editor", undefined, "Test123456", "被邀请者", OTHER_WORKSPACE_ID);

    const res = await app.inject({
      method: "POST",
      url: `/api/workspaces/${managedWorkspaceId}/members`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { email: invitee.user.email, role: "viewer" }
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.member.email).toBe(invitee.user.email);
    expect(body.member.memberRole).toBe("viewer");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/workspaces/${managedWorkspaceId}/members`,
      headers: { authorization: `Bearer ${managerToken}` }
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.items.some((item: { id: string }) => item.id === invitee.user.id)).toBe(true);
  });

  it("PATCH /api/workspaces/:id/members/:userId updates member role", async () => {
    const invitee = await registerWithRole(app, "editor", undefined, "Test123456", "待改角色", OTHER_WORKSPACE_ID);
    await app.inject({
      method: "POST",
      url: `/api/workspaces/${managedWorkspaceId}/members`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { email: invitee.user.email, role: "viewer" }
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/workspaces/${managedWorkspaceId}/members/${invitee.user.id}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { role: "editor" }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.member.memberRole).toBe("editor");
  });

  it("DELETE /api/workspaces/:id/members/:userId removes member", async () => {
    const invitee = await registerWithRole(app, "editor", undefined, "Test123456", "待移除者", OTHER_WORKSPACE_ID);

    await app.inject({
      method: "POST",
      url: `/api/workspaces/${managedWorkspaceId}/members`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { email: invitee.user.email, role: "editor" }
    });

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/workspaces/${managedWorkspaceId}/members/${invitee.user.id}`,
      headers: { authorization: `Bearer ${managerToken}` }
    });
    expect(deleteRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/workspaces/${managedWorkspaceId}/members`,
      headers: { authorization: `Bearer ${managerToken}` }
    });
    const listBody = JSON.parse(listRes.body);
    expect(listBody.items.some((item: { id: string }) => item.id === invitee.user.id)).toBe(false);
  });

  it("cannot remove the last workspace admin", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/workspaces/${managedWorkspaceId}/members/${managerUserId}`,
      headers: { authorization: `Bearer ${managerToken}` }
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.message).toContain("最后一位管理员");
  });

  it("workspace member list allows viewers who are members", async () => {
    const viewer = await registerWithRole(app, "viewer");
    const listRes = await app.inject({
      method: "GET",
      url: `/api/workspaces/${DEFAULT_WORKSPACE_ID}/members`,
      headers: { authorization: `Bearer ${viewer.token}` }
    });
    expect(listRes.statusCode).toBe(200);

    const invitee = await registerWithRole(app, "editor", undefined, "Test123456", "观察者不可邀请", OTHER_WORKSPACE_ID);
    const inviteRes = await app.inject({
      method: "POST",
      url: `/api/workspaces/${DEFAULT_WORKSPACE_ID}/members`,
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { email: invitee.user.email }
    });
    expect(inviteRes.statusCode).toBe(403);
  });

  it("isolates meetings by workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/meetings/${meetingId}`,
      headers: { authorization: `Bearer ${outsiderToken}` }
    });
    expect(res.statusCode).toBe(404);
  });

  it("records audit logs for meeting mutations", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/audit-logs?meetingId=${meetingId}`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((item: { action: string }) => item.action === "meeting.create")).toBe(true);
  });

  it("blocks viewer from audit logs", async () => {
    const viewer = await registerWithRole(app, "viewer");
    const res = await app.inject({
      method: "GET",
      url: "/api/audit-logs",
      headers: { authorization: `Bearer ${viewer.token}` }
    });
    expect(res.statusCode).toBe(403);
  });
});

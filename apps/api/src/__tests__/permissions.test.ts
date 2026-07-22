import { describe, expect, it } from "vitest";
import type { MeetingRecord, PublicUser } from "@meeting-flow/shared";
import { DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID } from "@meeting-flow/shared";
import { buildPermissions } from "../services/auth.js";
import {
  bindMeetingParticipants,
  canAccessMeeting,
  canManageWorkspace,
  isMeetingMember,
  resolveEffectiveRole
} from "../lib/workspaceAccess.js";

const admin: PublicUser = {
  id: "user-admin",
  email: "admin@test.com",
  name: "管理员",
  role: "admin",
  workspaceId: DEFAULT_WORKSPACE_ID,
  workspaceIds: [],
  workspaceMemberships: [],
  effectiveRole: "admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const editor: PublicUser = {
  id: "user-editor",
  email: "editor@test.com",
  name: "编辑",
  role: "editor",
  workspaceId: DEFAULT_WORKSPACE_ID,
  workspaceIds: [DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID],
  workspaceMemberships: [
    { workspaceId: DEFAULT_WORKSPACE_ID, role: "editor" },
    { workspaceId: TEAM_B_WORKSPACE_ID, role: "viewer" }
  ],
  effectiveRole: "editor",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const viewer: PublicUser = {
  id: "user-viewer",
  email: "viewer@test.com",
  name: "观察",
  role: "viewer",
  workspaceId: DEFAULT_WORKSPACE_ID,
  workspaceIds: [DEFAULT_WORKSPACE_ID],
  workspaceMemberships: [{ workspaceId: DEFAULT_WORKSPACE_ID, role: "viewer" }],
  effectiveRole: "viewer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const meeting = {
  ownerUserId: "user-owner",
  workspaceId: DEFAULT_WORKSPACE_ID,
  participants: [{ id: "p1", name: "编辑", role: "host", status: "accepted", userId: "user-editor" }]
} as MeetingRecord;

describe("buildPermissions", () => {
  it("grants admin full access", () => {
    expect(buildPermissions(admin, meeting)).toEqual({
      canCreate: true,
      canEdit: true,
      canCancel: true,
      canDelete: true,
      canViewMinutes: true
    });
  });

  it("keeps viewer read-only", () => {
    expect(buildPermissions(viewer, meeting)).toEqual({
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: true
    });
  });

  it("lets editor collaborate and delete team meetings", () => {
    expect(buildPermissions(editor, meeting)).toEqual({
      canCreate: true,
      canEdit: true,
      canCancel: true,
      canDelete: true,
      canViewMinutes: true
    });
  });

  it("denies cross-workspace meeting access", () => {
    const outsider = {
      ...editor,
      workspaceId: "workspace-other-001",
      workspaceMemberships: [{ workspaceId: "workspace-other-001", role: "editor" as const }],
      effectiveRole: "editor" as const
    };
    expect(buildPermissions(outsider, meeting)).toEqual({
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: false
    });
    expect(buildPermissions(outsider).canCreate).toBe(true);
  });

  it("uses per-workspace membership role for the same user", () => {
    const inTeamB = {
      ...editor,
      workspaceId: TEAM_B_WORKSPACE_ID,
      effectiveRole: "viewer" as const
    };
    const teamBMeeting = { ...meeting, workspaceId: TEAM_B_WORKSPACE_ID } as MeetingRecord;

    expect(resolveEffectiveRole(editor, DEFAULT_WORKSPACE_ID)).toBe("editor");
    expect(resolveEffectiveRole(editor, TEAM_B_WORKSPACE_ID)).toBe("viewer");
    expect(buildPermissions(inTeamB, teamBMeeting)).toEqual({
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: true
    });
  });
});

describe("workspaceAccess helpers", () => {
  it("binds creator to meeting participants", () => {
    const created = bindMeetingParticipants(
      {
        ...meeting,
        ownerUserId: editor.id,
        participants: [{ id: "p2", name: "编辑", role: "host", status: "accepted" }]
      } as MeetingRecord,
      editor
    );

    expect(created.participants.some((participant) => participant.userId === editor.id)).toBe(true);
    expect(isMeetingMember(editor, created)).toBe(true);
  });

  it("checks workspace membership before meeting access", () => {
    expect(canAccessMeeting(editor, meeting)).toBe(true);
    expect(canAccessMeeting({ ...editor, workspaceId: "workspace-other-001" }, meeting)).toBe(false);
    expect(canAccessMeeting(admin, { ...meeting, workspaceId: "workspace-other-001" })).toBe(true);
  });

  it("limits workspace management to workspace admins", () => {
    const workspaceAdmin = {
      ...editor,
      workspaceMemberships: [{ workspaceId: DEFAULT_WORKSPACE_ID, role: "admin" as const }],
      effectiveRole: "admin" as const
    };
    expect(canManageWorkspace(editor, DEFAULT_WORKSPACE_ID)).toBe(false);
    expect(canManageWorkspace(workspaceAdmin, DEFAULT_WORKSPACE_ID)).toBe(true);
    expect(canManageWorkspace(admin, DEFAULT_WORKSPACE_ID)).toBe(true);
  });
});

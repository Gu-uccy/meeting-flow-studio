import type { PublicUser, UserRole } from "@meeting-flow/shared";
import type { MeetingPermissions } from "@meeting-flow/shared";
import type { WorkbenchView } from "../../../contexts/WorkbenchContext";
import { meetingWorkbenchViews } from "./viewMeta";

const viewerMeetingViews: WorkbenchView[] = [
  "meeting",
  "workspace",
  "chat",
  "knowledge",
  "memories"
];

const editorMeetingViews: WorkbenchView[] = [...meetingWorkbenchViews];

const viewerPlatformViews: WorkbenchView[] = [];
const editorPlatformViews: WorkbenchView[] = ["runs"];
const adminPlatformViews: WorkbenchView[] = ["runs", "apps"];

/** Product capability role = active workspace membership (fallback to platform role). */
export function getProductRole(user: Pick<PublicUser, "role" | "effectiveRole"> | null | undefined): UserRole {
  return user?.effectiveRole ?? user?.role ?? "viewer";
}

/** Membership role for a specific workspace (platform admin → admin). */
export function getWorkspaceProductRole(
  user: Pick<PublicUser, "role" | "effectiveRole" | "workspaceId" | "workspaceMemberships"> | null | undefined,
  workspaceId: string
): UserRole {
  if (!user) {
    return "viewer";
  }
  if (user.role === "admin") {
    return "admin";
  }
  const membership = user.workspaceMemberships?.find((item) => item.workspaceId === workspaceId);
  if (membership) {
    return membership.role;
  }
  if (workspaceId === user.workspaceId) {
    return getProductRole(user);
  }
  return "viewer";
}

/** @deprecated Prefer getProductRole — alias kept for call-site consistency. */
export function getNavRole(user: Pick<PublicUser, "role" | "effectiveRole"> | null | undefined): UserRole {
  return getProductRole(user);
}

/** Platform-only surfaces (Node Agent studio, account integrations overview). */
export function getPlatformRole(user: Pick<PublicUser, "role"> | null | undefined): UserRole {
  return user?.role ?? "viewer";
}

export function getDefaultWorkbenchView(role: UserRole): WorkbenchView {
  return role === "viewer" ? "meeting" : "workspace";
}

export function getMeetingNavViews(role: UserRole): WorkbenchView[] {
  if (role === "viewer") {
    return viewerMeetingViews;
  }

  return editorMeetingViews;
}

export function getPlatformNavViews(role: UserRole): WorkbenchView[] {
  if (role === "admin") {
    return adminPlatformViews;
  }

  if (role === "editor") {
    return editorPlatformViews;
  }

  return viewerPlatformViews;
}

export function isWorkbenchViewAllowed(role: UserRole, view: WorkbenchView): boolean {
  if (view === "account") {
    return true;
  }

  return getMeetingNavViews(role).includes(view) || getPlatformNavViews(role).includes(view);
}

export function resolveWorkbenchView(role: UserRole, view: WorkbenchView): WorkbenchView {
  return isWorkbenchViewAllowed(role, view) ? view : getDefaultWorkbenchView(role);
}

export function canCreateMeeting(role: UserRole): boolean {
  return role !== "viewer";
}

export function canCreateWorkspace(role: UserRole): boolean {
  return role !== "viewer";
}

/** Workspace admins (or platform admins via effectiveRole) manage members / rename / delete. */
export function canManageWorkspaceMembers(role: UserRole): boolean {
  return role === "admin";
}

export function canOpenRunsConsole(role: UserRole): boolean {
  return role !== "viewer";
}

export function canAccessNodeAgentStudio(role: UserRole): boolean {
  return role === "admin";
}

export function isMeetingReadOnly(meeting?: { permissions: MeetingPermissions } | null): boolean {
  return !meeting?.permissions.canEdit;
}

export function shouldUseViewerMeetingHub(role: UserRole): boolean {
  return role === "viewer";
}

export function canManageAiSettings(role: UserRole): boolean {
  return role !== "viewer";
}

export function canViewAccountIntegrations(role: UserRole): boolean {
  return role === "admin";
}

/** 编辑者/管理员均可连接会议应用（飞书、Google） */
export function canManageMeetingAppConnections(role: UserRole): boolean {
  return role !== "viewer";
}

export function canViewAuditLogs(role: UserRole): boolean {
  return role !== "viewer";
}

export function canFilterRunsByOwnership(role: UserRole): boolean {
  return role === "editor";
}

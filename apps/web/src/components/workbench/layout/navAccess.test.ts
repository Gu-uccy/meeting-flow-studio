import { describe, expect, it } from "vitest";
import {
  canCreateMeeting,
  canFilterRunsByOwnership,
  canManageAiSettings,
  canManageWorkspaceMembers,
  canOpenRunsConsole,
  canViewAccountIntegrations,
  canManageMeetingAppConnections,
  canViewAuditLogs,
  getDefaultWorkbenchView,
  getMeetingNavViews,
  getNavRole,
  getPlatformNavViews,
  getProductRole,
  isMeetingReadOnly,
  isWorkbenchViewAllowed,
  resolveWorkbenchView,
  shouldUseViewerMeetingHub
} from "./navAccess";

describe("navAccess", () => {
  it("routes viewers to meeting overview by default", () => {
    expect(getDefaultWorkbenchView("viewer")).toBe("meeting");
    expect(getDefaultWorkbenchView("editor")).toBe("workspace");
  });

  it("limits viewer navigation to meeting participation views", () => {
    expect(getMeetingNavViews("viewer")).toEqual([
      "meeting",
      "workspace",
      "chat",
      "knowledge",
      "memories"
    ]);
    expect(getPlatformNavViews("viewer")).toEqual([]);
    expect(isWorkbenchViewAllowed("viewer", "apps")).toBe(false);
    expect(isWorkbenchViewAllowed("viewer", "account")).toBe(true);
  });

  it("puts workspace config first in editor navigation", () => {
    const views = getMeetingNavViews("editor");
    expect(views[0]).toBe("config");
    expect(views[1]).toBe("workspace");
    expect(getPlatformNavViews("editor")).toEqual(["runs"]);
    expect(getPlatformNavViews("admin")).toEqual(["runs", "apps"]);
    expect(canCreateMeeting("viewer")).toBe(false);
    expect(canOpenRunsConsole("viewer")).toBe(false);
  });

  it("falls back to the role default when a view is not allowed", () => {
    expect(resolveWorkbenchView("viewer", "apps")).toBe("meeting");
    expect(resolveWorkbenchView("editor", "apps")).toBe("workspace");
  });

  it("detects read-only meetings from permissions", () => {
    expect(
      isMeetingReadOnly({
        permissions: {
          canCreate: false,
          canEdit: false,
          canCancel: false,
          canDelete: false,
          canViewMinutes: true
        }
      })
    ).toBe(true);
    expect(
      isMeetingReadOnly({
        permissions: {
          canCreate: true,
          canEdit: true,
          canCancel: true,
          canDelete: true,
          canViewMinutes: true
        }
      })
    ).toBe(false);
  });

  it("exposes P3 role helpers", () => {
    expect(shouldUseViewerMeetingHub("viewer")).toBe(true);
    expect(shouldUseViewerMeetingHub("editor")).toBe(false);
    expect(canManageAiSettings("viewer")).toBe(false);
    expect(canManageAiSettings("editor")).toBe(true);
    expect(canViewAccountIntegrations("admin")).toBe(true);
    expect(canViewAccountIntegrations("editor")).toBe(false);
    expect(canManageMeetingAppConnections("editor")).toBe(true);
    expect(canManageMeetingAppConnections("viewer")).toBe(false);
    expect(canViewAuditLogs("editor")).toBe(true);
    expect(canViewAuditLogs("viewer")).toBe(false);
    expect(canFilterRunsByOwnership("editor")).toBe(true);
    expect(canFilterRunsByOwnership("admin")).toBe(false);
  });

  it("exposes workspace-admin-only member management", () => {
    expect(canManageWorkspaceMembers("admin")).toBe(true);
    expect(canManageWorkspaceMembers("editor")).toBe(false);
    expect(canManageWorkspaceMembers("viewer")).toBe(false);
  });

  it("prefers effectiveRole for product navigation role", () => {
    expect(
      getProductRole({
        role: "editor",
        effectiveRole: "viewer"
      })
    ).toBe("viewer");
    expect(getNavRole({ role: "admin", effectiveRole: "editor" })).toBe("editor");
  });
});

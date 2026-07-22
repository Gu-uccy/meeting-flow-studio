import type { MeetingRecord, PublicUser, User, UserRole, Workspace } from "@meeting-flow/shared";
import { DEFAULT_WORKSPACE_ID } from "@meeting-flow/shared";

export function isPlatformAdmin(user: Pick<PublicUser | User, "role">) {
  return user.role === "admin";
}

export function resolveEffectiveRole(
  user: Pick<PublicUser, "role" | "workspaceMemberships" | "effectiveRole" | "workspaceId">,
  workspaceId?: string
): UserRole | null {
  if (isPlatformAdmin(user)) {
    return "admin";
  }

  const targetWorkspaceId = workspaceId || user.workspaceId || DEFAULT_WORKSPACE_ID;
  const memberships = user.workspaceMemberships ?? [];
  const membership = memberships.find((item) => item.workspaceId === targetWorkspaceId);
  if (membership) {
    return membership.role;
  }

  if (!workspaceId || workspaceId === (user.workspaceId || DEFAULT_WORKSPACE_ID)) {
    return user.effectiveRole ?? null;
  }

  return null;
}

export function getAccessibleWorkspaceIds(
  user: Pick<PublicUser, "role" | "workspaceId" | "workspaceIds" | "workspaceMemberships"> | Pick<User, "role" | "workspaceId" | "workspaceIds">,
  workspaces: Workspace[]
) {
  if (isPlatformAdmin(user)) {
    return workspaces.map((workspace) => workspace.id);
  }

  const memberships = "workspaceMemberships" in user ? user.workspaceMemberships : undefined;
  const fromMemberships = memberships?.map((item) => item.workspaceId) ?? [];
  if (fromMemberships.length > 0) {
    return [...new Set(fromMemberships)];
  }

  if (user.workspaceIds && user.workspaceIds.length > 0) {
    return [...new Set(user.workspaceIds)];
  }

  return [user.workspaceId || DEFAULT_WORKSPACE_ID];
}

export function hasWorkspaceMembership(
  user: Pick<PublicUser, "role" | "workspaceId" | "workspaceIds" | "workspaceMemberships"> | Pick<User, "role" | "workspaceId" | "workspaceIds">,
  workspaceId: string
) {
  if (isPlatformAdmin(user)) {
    return true;
  }

  const memberships = "workspaceMemberships" in user ? user.workspaceMemberships : undefined;
  if (memberships && memberships.length > 0) {
    return memberships.some((item) => item.workspaceId === workspaceId);
  }

  return (user.workspaceIds ?? []).includes(workspaceId) || user.workspaceId === workspaceId;
}

/** Membership (or platform admin). Does not require active workspace context. */
export function canAccessWorkspace(user: PublicUser, workspaceId: string) {
  return hasWorkspaceMembership(user, workspaceId);
}

export function canManageWorkspace(user: PublicUser, workspaceId: string, _workspaces?: Workspace[]) {
  const effective = resolveEffectiveRole(user, workspaceId);
  return effective === "admin";
}

/** Meeting access: platform admin, or member whose active workspace matches the meeting. */
export function canAccessMeeting(user: PublicUser, meeting: MeetingRecord) {
  const meetingWorkspaceId = meeting.workspaceId || DEFAULT_WORKSPACE_ID;
  if (isPlatformAdmin(user)) {
    return true;
  }

  if (!hasWorkspaceMembership(user, meetingWorkspaceId)) {
    return false;
  }

  return (user.workspaceId || DEFAULT_WORKSPACE_ID) === meetingWorkspaceId;
}

export function isMeetingMember(user: PublicUser, meeting: MeetingRecord) {
  return meeting.participants.some((participant) => participant.userId === user.id);
}

export function bindMeetingParticipants(meeting: MeetingRecord, user: PublicUser): MeetingRecord {
  const participants = meeting.participants.map((participant) => {
    if (participant.userId) {
      return participant;
    }
    if (participant.name === user.name || (participant.role === "host" && meeting.ownerUserId === user.id)) {
      return { ...participant, userId: user.id };
    }
    return participant;
  });

  if (!participants.some((participant) => participant.userId === user.id)) {
    participants.unshift({
      id: `participant-${Date.now()}`,
      name: user.name,
      role: "host",
      status: "accepted",
      userId: user.id
    });
  }

  return {
    ...meeting,
    participants,
    attendeeCount: participants.length
  };
}

export function filterMeetingsForUser<T extends MeetingRecord>(meetings: T[], user: PublicUser) {
  return meetings.filter((meeting) => canAccessMeeting(user, meeting));
}

import type { PublicUser, User, WorkspaceMember, WorkspaceMemberRole } from "@meeting-flow/shared";
import { DEFAULT_WORKSPACE_ID } from "@meeting-flow/shared";
import { findUserByEmail, findUserById, listStoredUsers, updateUserRecord } from "../userStore.js";
import {
  canManageWorkspace,
  hasWorkspaceMembership,
  isPlatformAdmin,
  resolveEffectiveRole
} from "../lib/workspaceAccess.js";
import { findWorkspaceById, loadWorkspaces } from "../workspaceStore.js";
import { toPublicUser } from "./auth.js";
import {
  countAdminsInWorkspace,
  getMembershipRole,
  listMembershipsForUser,
  listMembershipsForWorkspace,
  membershipRoleRank,
  removeMembership,
  upsertMembership
} from "../workspaceMemberStore.js";

async function syncWorkspaceIds(user: User) {
  const memberships = await listMembershipsForUser(user.id);
  const workspaceIds = memberships.map((item) => item.workspaceId);
  const nextIds = workspaceIds.length > 0 ? workspaceIds : [DEFAULT_WORKSPACE_ID];
  let nextWorkspaceId = user.workspaceId;
  if (!nextIds.includes(nextWorkspaceId)) {
    nextWorkspaceId = nextIds[0] ?? DEFAULT_WORKSPACE_ID;
  }

  const updated: User = {
    ...user,
    workspaceId: nextWorkspaceId,
    workspaceIds: nextIds,
    updatedAt: new Date().toISOString()
  };
  await updateUserRecord(updated);
  return updated;
}

function toWorkspaceMember(user: PublicUser, workspaceId: string, memberRole: WorkspaceMemberRole): WorkspaceMember {
  return {
    ...user,
    role: user.role,
    memberRole,
    isActive: user.workspaceId === workspaceId
  };
}

export async function listWorkspaceMembers(workspaceId: string) {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new Error("未找到该工作区");
  }

  const memberships = await listMembershipsForWorkspace(workspaceId);
  const users = await listStoredUsers();
  const byId = new Map(users.map((user) => [user.id, user]));

  const members: WorkspaceMember[] = [];
  for (const membership of memberships) {
    const stored = byId.get(membership.userId);
    if (!stored) continue;
    const publicUser = await toPublicUser(stored);
    members.push(toWorkspaceMember(publicUser, workspaceId, membership.role));
  }

  return members.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

function assertCanAssignRole(actor: PublicUser, workspaceId: string, targetRole: WorkspaceMemberRole) {
  if (isPlatformAdmin(actor)) {
    return;
  }

  const actorRole = resolveEffectiveRole(actor, workspaceId);
  if (actorRole !== "admin") {
    throw new Error("当前账号无权管理工作区成员");
  }

  if (membershipRoleRank(targetRole) > membershipRoleRank(actorRole)) {
    throw new Error("不能授予高于自身的工作区角色");
  }
}

export async function inviteWorkspaceMember(
  actor: PublicUser,
  workspaceId: string,
  email: string,
  role: WorkspaceMemberRole = "editor"
) {
  const workspaces = await loadWorkspaces();
  if (!canManageWorkspace(actor, workspaceId, workspaces)) {
    throw new Error("当前账号无权管理工作区成员");
  }

  assertCanAssignRole(actor, workspaceId, role);

  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new Error("未找到该工作区");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("未找到该邮箱对应的用户，请先让其注册账号");
  }

  const existingRole = await getMembershipRole(workspaceId, user.id);
  if (existingRole) {
    throw new Error("该用户已是工作区成员");
  }

  await upsertMembership({ workspaceId, userId: user.id, role });
  const updatedUser = await syncWorkspaceIds(user);
  const publicUser = await toPublicUser(updatedUser);
  return toWorkspaceMember(publicUser, workspaceId, role);
}

export async function updateWorkspaceMemberRole(
  actor: PublicUser,
  workspaceId: string,
  targetUserId: string,
  role: WorkspaceMemberRole
) {
  const workspaces = await loadWorkspaces();
  if (!canManageWorkspace(actor, workspaceId, workspaces)) {
    throw new Error("当前账号无权管理工作区成员");
  }

  assertCanAssignRole(actor, workspaceId, role);

  const currentRole = await getMembershipRole(workspaceId, targetUserId);
  if (!currentRole) {
    throw new Error("该用户不是此工作区成员");
  }

  if (currentRole === "admin" && role !== "admin") {
    const adminCount = await countAdminsInWorkspace(workspaceId);
    if (adminCount <= 1) {
      throw new Error("不能降级工作区的最后一位管理员");
    }
  }

  await upsertMembership({ workspaceId, userId: targetUserId, role });
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new Error("未找到该成员");
  }

  const publicUser = await toPublicUser(target);
  return toWorkspaceMember(publicUser, workspaceId, role);
}

export async function removeWorkspaceMember(actor: PublicUser, workspaceId: string, targetUserId: string) {
  const workspaces = await loadWorkspaces();
  if (!canManageWorkspace(actor, workspaceId, workspaces)) {
    throw new Error("当前账号无权管理工作区成员");
  }

  const target = await findUserById(targetUserId);
  if (!target) {
    throw new Error("未找到该成员");
  }

  if (!hasWorkspaceMembership(await toPublicUser(target), workspaceId) && !(await getMembershipRole(workspaceId, targetUserId))) {
    throw new Error("该用户不是此工作区成员");
  }

  const currentRole = await getMembershipRole(workspaceId, targetUserId);
  if (currentRole === "admin") {
    const adminCount = await countAdminsInWorkspace(workspaceId);
    if (adminCount <= 1) {
      throw new Error("不能移除工作区的最后一位管理员");
    }
  }

  await removeMembership(workspaceId, targetUserId);
  await syncWorkspaceIds(target);
}

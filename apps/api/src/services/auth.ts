import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from "fastify";
import bcrypt from "bcryptjs";
import type { MeetingRecord, MeetingPermissions, PublicUser, User, UserRole } from "@meeting-flow/shared";
import { DEFAULT_WORKSPACE_ID } from "@meeting-flow/shared";
import { findUserByEmail, findUserById, createUser as createUserInStore, updateUserRecord } from "../userStore.js";
import {
  canAccessMeeting,
  getAccessibleWorkspaceIds,
  isPlatformAdmin,
  resolveEffectiveRole
} from "../lib/workspaceAccess.js";
import { createWorkspace, loadWorkspaces } from "../workspaceStore.js";
import { listMembershipsForUser, upsertMembership } from "../workspaceMemberStore.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = "7d";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: string };
    user: PublicUser;
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(app: FastifyInstance, user: PublicUser) {
  return app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function toPublicUser(user: User): Promise<PublicUser> {
  const workspaceMemberships = await listMembershipsForUser(user.id);
  const workspaceIds =
    workspaceMemberships.length > 0
      ? workspaceMemberships.map((item) => item.workspaceId)
      : (user.workspaceIds ?? [user.workspaceId || DEFAULT_WORKSPACE_ID]);

  const activeWorkspaceId = workspaceIds.includes(user.workspaceId)
    ? user.workspaceId
    : (workspaceIds[0] ?? DEFAULT_WORKSPACE_ID);

  const base: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: activeWorkspaceId,
    workspaceIds,
    workspaceMemberships,
    effectiveRole: "viewer",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  const effectiveRole = resolveEffectiveRole(base, activeWorkspaceId) ?? "viewer";
  return { ...base, effectiveRole };
}

export async function registerUser(
  app: FastifyInstance,
  email: string,
  password: string,
  name: string
) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    throw new Error("该邮箱已被注册");
  }

  const passwordHash = await hashPassword(password);
  const user = await createUserInStore(normalizedEmail, name, passwordHash, "editor");
  const publicUser = await toPublicUser(user);
  const token = signToken(app, publicUser);

  return { user: publicUser, token, effectiveRole: publicUser.effectiveRole };
}

export async function loginUser(app: FastifyInstance, email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error("邮箱或密码错误");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("邮箱或密码错误");
  }

  const publicUser = await toPublicUser(user);
  const token = signToken(app, publicUser);

  return { user: publicUser, token, effectiveRole: publicUser.effectiveRole };
}

export function buildPermissions(user: PublicUser, meeting?: MeetingRecord): MeetingPermissions {
  if (meeting && !canAccessMeeting(user, meeting)) {
    return {
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: false
    };
  }

  const workspaceId = meeting?.workspaceId || user.workspaceId || DEFAULT_WORKSPACE_ID;
  const effective = resolveEffectiveRole(user, workspaceId);

  if (!effective) {
    return {
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: false
    };
  }

  if (effective === "admin") {
    return {
      canCreate: true,
      canEdit: true,
      canCancel: true,
      canDelete: true,
      canViewMinutes: true
    };
  }

  if (effective === "viewer") {
    return {
      canCreate: false,
      canEdit: false,
      canCancel: false,
      canDelete: false,
      canViewMinutes: true
    };
  }

  // editor：可维护并删除工作区内会议
  return {
    canCreate: true,
    canEdit: true,
    canCancel: true,
    canDelete: true,
    canViewMinutes: true
  };
}

export async function switchUserWorkspace(app: FastifyInstance, userId: string, workspaceId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("用户不存在");
  }

  const publicPreview = await toPublicUser(user);
  const workspaces = await loadWorkspaces();
  const accessibleIds = getAccessibleWorkspaceIds(publicPreview, workspaces);
  if (!accessibleIds.includes(workspaceId)) {
    throw new Error("当前账号无权切换到该工作区");
  }

  const updatedUser: User = {
    ...user,
    workspaceId,
    workspaceIds: publicPreview.workspaceIds,
    updatedAt: new Date().toISOString()
  };
  await updateUserRecord(updatedUser);

  const publicUser = await toPublicUser(updatedUser);
  const token = signToken(app, publicUser);
  return { user: publicUser, token, effectiveRole: publicUser.effectiveRole };
}

export async function createWorkspaceForUser(app: FastifyInstance, userId: string, name: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("用户不存在");
  }

  const publicPreview = await toPublicUser(user);
  if (publicPreview.effectiveRole === "viewer" && !isPlatformAdmin(user)) {
    throw new Error("当前账号无权创建工作区");
  }

  // Seed / global viewer accounts cannot create workspaces
  if (user.role === "viewer" && !isPlatformAdmin(user)) {
    throw new Error("当前账号无权创建工作区");
  }

  const workspace = await createWorkspace({ name });
  await upsertMembership({
    workspaceId: workspace.id,
    userId: user.id,
    role: "admin"
  });

  const memberships = await listMembershipsForUser(user.id);
  const workspaceIds = memberships.map((item) => item.workspaceId);

  const updatedUser: User = {
    ...user,
    workspaceId: workspace.id,
    workspaceIds,
    updatedAt: new Date().toISOString()
  };
  await updateUserRecord(updatedUser);

  const publicUser = await toPublicUser(updatedUser);
  const token = signToken(app, publicUser);
  return { workspace, user: publicUser, token, effectiveRole: publicUser.effectiveRole };
}

export function createAuthPreHandler(): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<{ sub: string; email: string; role: string }>();
      const user = await findUserById(decoded.sub);

      if (!user) {
        return reply.code(401).send({ message: "认证已失效，请重新登录" });
      }

      request.user = await toPublicUser(user);
    } catch {
      return reply.code(401).send({ message: "请先登录" });
    }
  };
}

export function getSessionEffectiveRole(user: PublicUser): UserRole {
  return resolveEffectiveRole(user, user.workspaceId) ?? "viewer";
}

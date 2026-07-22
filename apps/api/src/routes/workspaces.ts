import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createWorkspaceInputSchema,
  inviteWorkspaceMemberInputSchema,
  renameWorkspaceInputSchema,
  updateWorkspaceMemberInputSchema,
  DEFAULT_WORKSPACE_ID
} from "@meeting-flow/shared";
import { authenticate } from "./auth.js";
import {
  deleteWorkspace,
  findWorkspaceById,
  isSeedWorkspace,
  loadWorkspaces,
  renameWorkspace
} from "../workspaceStore.js";
import { listAuditLogs } from "../auditStore.js";
import { recordAuditLog } from "../lib/audit.js";
import {
  canManageWorkspace,
  getAccessibleWorkspaceIds,
  hasWorkspaceMembership,
  resolveEffectiveRole
} from "../lib/workspaceAccess.js";
import { createWorkspaceForUser, switchUserWorkspace } from "../services/auth.js";
import {
  inviteWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole
} from "../services/workspaceMembers.js";
import { loadUsers, updateUserRecord } from "../userStore.js";
import { loadMeetings } from "../meetingStore.js";
import { deleteMembershipsForWorkspace } from "../workspaceMemberStore.js";

export async function workspaceRoutes(app: FastifyInstance) {
  app.get("/api/workspaces", { preHandler: [authenticate] }, async (request: FastifyRequest) => {
    const workspaces = await loadWorkspaces();
    const accessibleIds = new Set(getAccessibleWorkspaceIds(request.user, workspaces));

    return {
      items: workspaces.filter((workspace) => accessibleIds.has(workspace.id)),
      activeWorkspaceId: request.user.workspaceId
    };
  });

  app.get("/api/workspaces/current", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const workspace = await findWorkspaceById(request.user.workspaceId);
    if (!workspace) return reply.code(404).send({ message: "未找到当前工作区" });
    return { workspace };
  });

  app.post("/api/workspaces", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const payload = createWorkspaceInputSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "工作区创建参数不合法", issues: payload.error.flatten() });
    }

    try {
      const result = await createWorkspaceForUser(app, request.user.id, payload.data.name);
      await recordAuditLog({
        workspaceId: result.workspace.id,
        actor: result.user,
        action: "workspace.create",
        resourceType: "workspace",
        resourceId: result.workspace.id,
        summary: `创建工作区「${result.workspace.name}」`
      });
      return reply.code(201).send({
        ...result,
        message: `工作区「${result.workspace.name}」已创建`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建工作区失败";
      const statusCode = message.includes("无权") ? 403 : 400;
      return reply.code(statusCode).send({ message });
    }
  });

  app.patch("/api/workspaces/:workspaceId", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const payload = renameWorkspaceInputSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ message: "工作区重命名参数不合法", issues: payload.error.flatten() });
    }

    const workspaces = await loadWorkspaces();
    if (!canManageWorkspace(request.user, workspaceId, workspaces)) {
      return reply.code(403).send({ message: "当前账号无权重命名该工作区" });
    }

    try {
      const workspace = await renameWorkspace(workspaceId, payload.data.name);
      await recordAuditLog({
        workspaceId,
        actor: request.user,
        action: "workspace.rename",
        resourceType: "workspace",
        resourceId: workspaceId,
        summary: `重命名工作区为「${workspace.name}」`
      });
      return { workspace, message: `工作区已重命名为「${workspace.name}」` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "重命名工作区失败";
      return reply.code(message.includes("未找到") ? 404 : 400).send({ message });
    }
  });

  app.delete("/api/workspaces/:workspaceId", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const workspaces = await loadWorkspaces();

    if (!canManageWorkspace(request.user, workspaceId, workspaces)) {
      return reply.code(403).send({ message: "当前账号无权删除该工作区" });
    }

    if (isSeedWorkspace(workspaceId)) {
      return reply.code(400).send({ message: "系统预置工作区不可删除" });
    }

    const meetings = await loadMeetings();
    if (meetings.some((meeting) => (meeting.workspaceId || DEFAULT_WORKSPACE_ID) === workspaceId)) {
      return reply.code(400).send({ message: "工作区仍有会议，请先迁移或删除会议后再删除工作区" });
    }

    try {
      const workspace = await deleteWorkspace(workspaceId);
      await deleteMembershipsForWorkspace(workspaceId);

      const users = await loadUsers();
      for (const user of users) {
        const workspaceIds = (user.workspaceIds ?? []).filter((id) => id !== workspaceId);
        const nextWorkspaceId = user.workspaceId === workspaceId
          ? (workspaceIds[0] ?? DEFAULT_WORKSPACE_ID)
          : user.workspaceId;

        if (workspaceIds.length !== (user.workspaceIds ?? []).length || nextWorkspaceId !== user.workspaceId) {
          await updateUserRecord({
            ...user,
            workspaceId: nextWorkspaceId,
            workspaceIds: workspaceIds.length > 0 ? workspaceIds : [DEFAULT_WORKSPACE_ID],
            updatedAt: new Date().toISOString()
          });
        }
      }

      await recordAuditLog({
        workspaceId: request.user.workspaceId === workspaceId ? DEFAULT_WORKSPACE_ID : request.user.workspaceId,
        actor: request.user,
        action: "workspace.delete",
        resourceType: "workspace",
        resourceId: workspaceId,
        summary: `删除工作区「${workspace.name}」`,
        metadata: { deletedWorkspaceId: workspaceId, deletedWorkspaceName: workspace.name }
      });

      let token: string | undefined;
      let user = request.user;
      if (request.user.workspaceId === workspaceId) {
        const switched = await switchUserWorkspace(app, request.user.id, DEFAULT_WORKSPACE_ID);
        user = switched.user;
        token = switched.token;
      }

      return {
        deletedId: workspaceId,
        user,
        token,
        message: `工作区「${workspace.name}」已删除`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除工作区失败";
      return reply.code(message.includes("未找到") ? 404 : 400).send({ message });
    }
  });

  app.get("/api/workspaces/:workspaceId/members", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    // Any workspace member (or platform admin) may view the roster; invite/update/remove stay admin-only.
    if (!hasWorkspaceMembership(request.user, workspaceId)) {
      return reply.code(403).send({ message: "当前账号无权查看工作区成员" });
    }

    try {
      const items = await listWorkspaceMembers(workspaceId);
      return { items };
    } catch (error) {
      const message = error instanceof Error ? error.message : "成员列表加载失败";
      return reply.code(message.includes("未找到") ? 404 : 400).send({ message });
    }
  });

  app.post("/api/workspaces/:workspaceId/members", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const payload = inviteWorkspaceMemberInputSchema.safeParse(request.body);

    if (!payload.success) {
      return reply.code(400).send({ message: "邀请参数不合法", issues: payload.error.flatten() });
    }

    try {
      const member = await inviteWorkspaceMember(
        request.user,
        workspaceId,
        payload.data.email,
        payload.data.role
      );
      await recordAuditLog({
        workspaceId,
        actor: request.user,
        action: "workspace.member_invite",
        resourceType: "workspace",
        resourceId: workspaceId,
        summary: `邀请成员 ${member.email}（${member.memberRole}）`,
        metadata: {
          memberUserId: member.id,
          memberEmail: member.email,
          memberRole: member.memberRole
        }
      });
      return reply.code(201).send({ member, message: `已邀请 ${member.email} 加入工作区` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "邀请成员失败";
      const statusCode = message.includes("无权") ? 403 : message.includes("未找到") ? 404 : 400;
      return reply.code(statusCode).send({ message });
    }
  });

  app.patch("/api/workspaces/:workspaceId/members/:userId", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };
    const payload = updateWorkspaceMemberInputSchema.safeParse(request.body);

    if (!payload.success) {
      return reply.code(400).send({ message: "成员角色更新参数不合法", issues: payload.error.flatten() });
    }

    try {
      const member = await updateWorkspaceMemberRole(request.user, workspaceId, userId, payload.data.role);
      await recordAuditLog({
        workspaceId,
        actor: request.user,
        action: "workspace.member_role_update",
        resourceType: "workspace",
        resourceId: workspaceId,
        summary: `将成员 ${member.email} 角色更新为 ${member.memberRole}`,
        metadata: {
          memberUserId: member.id,
          memberEmail: member.email,
          memberRole: member.memberRole
        }
      });
      return { member, message: `已更新 ${member.email} 的工作区角色` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新成员角色失败";
      const statusCode =
        message.includes("无权") || message.includes("高于") || message.includes("最后一位")
          ? 403
          : message.includes("未找到") || message.includes("不是")
            ? 404
            : 400;
      return reply.code(statusCode).send({ message });
    }
  });

  app.delete("/api/workspaces/:workspaceId/members/:userId", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const { workspaceId, userId } = request.params as { workspaceId: string; userId: string };

    try {
      await removeWorkspaceMember(request.user, workspaceId, userId);
      await recordAuditLog({
        workspaceId,
        actor: request.user,
        action: "workspace.member_remove",
        resourceType: "workspace",
        resourceId: workspaceId,
        summary: `移除工作区成员`,
        metadata: { removedUserId: userId }
      });
      return { message: "成员已从工作区移除" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "移除成员失败";
      const statusCode =
        message.includes("无权") || message.includes("最后一位")
          ? 403
          : message.includes("未找到")
            ? 404
            : 400;
      return reply.code(statusCode).send({ message });
    }
  });

  app.get("/api/audit-logs", { preHandler: [authenticate] }, async (request: FastifyRequest, reply) => {
    const effective = resolveEffectiveRole(request.user, request.user.workspaceId);
    if (!effective || effective === "viewer") {
      return reply.code(403).send({ message: "当前账号无权查看操作审计" });
    }

    const query = request.query as { meetingId?: string; limit?: string };
    const items = await listAuditLogs({
      workspaceId: request.user.workspaceId,
      meetingId: typeof query.meetingId === "string" ? query.meetingId : undefined,
      limit: query.limit ? Number(query.limit) : undefined
    });

    return { items };
  });
}

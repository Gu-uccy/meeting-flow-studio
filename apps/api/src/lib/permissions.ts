import type { FastifyReply } from "fastify";
import type { MeetingRecord, PublicUser } from "@meeting-flow/shared";
import { buildPermissions } from "../services/auth.js";
import { canAccessMeeting, resolveEffectiveRole } from "./workspaceAccess.js";

function deny(reply: FastifyReply, message: string): false {
  reply.code(403).send({ message });
  return false;
}

export function assertMeetingAccess(user: PublicUser, meeting: MeetingRecord, reply: FastifyReply): boolean {
  if (!canAccessMeeting(user, meeting)) {
    return deny(reply, "当前账号无权访问该工作区的会议");
  }
  return true;
}

export function assertCanCreateMeeting(user: PublicUser, reply: FastifyReply): boolean {
  if (!buildPermissions(user).canCreate) {
    return deny(reply, "当前账号无权创建会议");
  }
  return true;
}

export function assertMeetingEdit(
  user: PublicUser,
  meeting: MeetingRecord,
  reply: FastifyReply,
  message = "当前账号无权修改该会议"
): boolean {
  if (!assertMeetingAccess(user, meeting, reply)) return false;
  if (!buildPermissions(user, meeting).canEdit) {
    return deny(reply, message);
  }
  return true;
}

export function assertMeetingDelete(user: PublicUser, meeting: MeetingRecord, reply: FastifyReply): boolean {
  if (!assertMeetingAccess(user, meeting, reply)) return false;
  if (!buildPermissions(user, meeting).canDelete) {
    return deny(reply, "当前账号无权删除该会议");
  }
  return true;
}

export function assertWorkflowEditor(user: PublicUser, reply: FastifyReply, message = "当前账号无权修改工作流模板"): boolean {
  const effective = resolveEffectiveRole(user, user.workspaceId);
  if (!effective || effective === "viewer") {
    return deny(reply, message);
  }
  return true;
}

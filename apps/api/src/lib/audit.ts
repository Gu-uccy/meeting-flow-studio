import type { AuditAction, AuditResourceType, MeetingRecord, PublicUser } from "@meeting-flow/shared";
import { DEFAULT_WORKSPACE_ID } from "@meeting-flow/shared";
import { appendAuditLog } from "../auditStore.js";

export async function recordAuditLog(input: {
  workspaceId?: string;
  actor: PublicUser;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
  meeting?: MeetingRecord;
}) {
  const now = new Date().toISOString();
  const workspaceId = input.workspaceId
    ?? input.meeting?.workspaceId
    ?? input.actor.workspaceId
    ?? DEFAULT_WORKSPACE_ID;

  await appendAuditLog({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId,
    actorUserId: input.actor.id,
    actorName: input.actor.name,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: now
  });
}

import {
  type MeetingRecord,
  type MeetingMemory,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate,
  type MeetingRecordWithPermissions,
  type MeetingStatus,
  type MeetingDashboardSummary,
  type PublicUser,
  type EditableMeetingInput,
  type CreateMeetingInput,
  type UpdateMeetingInput,
  type AiApplicationVersion,
  updateMeetingStatusSchema,
} from "@meeting-flow/shared";
import { applyMeetingRuntimeWriteback } from "../services/runtimeMapping.js";
import { buildPermissions } from "../services/auth.js";
import { saveMeetings } from "../meetingStore.js";
import { saveMeetingMemories } from "../memoryStore.js";
import { executeWorkflowRun } from "../services/executor.js";
import { buildAiApplicationsFromTemplates } from "@meeting-flow/shared";

// ── App context shared across all route modules ──

export interface AppContext {
  meetings: MeetingRecord[];
  meetingMemories: MeetingMemory[];
  workflowRuns: ProductWorkflowRun[];
  workflowTemplates: ProductWorkflowTemplate[];
  broadcastWorkflowUpdate?: (run: ProductWorkflowRun) => void;
}

export function notifyWorkflowUpdate(ctx: AppContext, run: ProductWorkflowRun) {
  ctx.broadcastWorkflowUpdate?.(run);
}

// ── Helpers ──

export function sortByUpdatedAtDesc(left: MeetingRecord, right: MeetingRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function sortRunsByStartedAtDesc(left: ProductWorkflowRun, right: ProductWorkflowRun) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

export function sortMemoriesByUpdatedAtDesc(left: MeetingMemory, right: MeetingMemory) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function buildMeetingSummary(items: MeetingRecord[]): MeetingDashboardSummary {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === "draft").length,
    scheduled: items.filter((item) => item.status === "scheduled").length,
    inProgress: items.filter((item) => item.status === "in_progress").length,
    completed: items.filter((item) => item.status === "completed").length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
  };
}

export function normalizeStatus(value: unknown): MeetingStatus | "all" {
  if (value === "all") return "all";
  const parsed = updateMeetingStatusSchema.shape.status.safeParse(value);
  return parsed.success ? parsed.data : "all";
}

export function normalizeText(value: string) {
  return value.trim();
}

export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean))];
}

export function durationBetween(startAt: string, endAt: string) {
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Math.max(15, Math.round(diff / 60000));
}

export function hasValidMeetingWindow(startAt: string, endAt: string) {
  return new Date(startAt).getTime() < new Date(endAt).getTime();
}

export function assignIds<T extends Record<string, unknown>>(items: T[], prefix: string) {
  return items.map((item, index) => ({
    ...item,
    id: `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  }));
}

export function sanitizeMeetingInput(input: EditableMeetingInput) {
  return {
    ...input,
    title: normalizeText(input.title),
    host: normalizeText(input.host),
    owner: normalizeText(input.owner),
    description: normalizeText(input.description),
    meetingGoal: normalizeText(input.meetingGoal),
    location: normalizeText(input.location),
    meetingLink: normalizeText(input.meetingLink),
    recurrence: normalizeText(input.recurrence),
    notes: input.notes.trim(),
    minutes: input.minutes.trim(),
    tags: normalizeTags(input.tags),
    participants: input.participants.map((p) => ({ ...p, name: normalizeText(p.name) })),
    agendaItems: input.agendaItems.map((a) => ({ ...a, title: normalizeText(a.title) })),
    actionItems: input.actionItems.map((a) => ({
      ...a,
      content: normalizeText(a.content),
      owner: normalizeText(a.owner),
      dueDate: normalizeText(a.dueDate),
    })),
  };
}

export function validateMeetingInput(input: { startAt: string; endAt: string; isRecurring: boolean; recurrence: string }) {
  if (!hasValidMeetingWindow(input.startAt, input.endAt)) return "结束时间必须晚于开始时间";
  if (input.isRecurring && !input.recurrence.trim()) return "重复会议需要填写重复规则";
  return "";
}

export function buildMeetingRecord(
  input: EditableMeetingInput,
  options: { id?: string; createdAt?: string; submittedAt?: string; ownerUserId?: string }
): MeetingRecord {
  const now = new Date().toISOString();
  const sanitized = sanitizeMeetingInput(input);
  return {
    id: options.id ?? `meeting-${Date.now()}`,
    ...sanitized,
    ownerUserId: options.ownerUserId ?? "",
    startAt: new Date(sanitized.startAt).toISOString(),
    endAt: new Date(sanitized.endAt).toISOString(),
    participants: assignIds(sanitized.participants, "participant"),
    agendaItems: assignIds(sanitized.agendaItems, "agenda"),
    actionItems: assignIds(sanitized.actionItems, "action"),
    attendeeCount: sanitized.participants.length,
    durationMinutes: durationBetween(sanitized.startAt, sanitized.endAt),
    createdAt: options.createdAt ?? now,
    updatedAt: now,
    submittedAt: options.submittedAt ?? (sanitized.status === "draft" ? "" : now),
  };
}

export function createMeetingRecord(input: CreateMeetingInput, ownerUserId?: string): MeetingRecord {
  const status = input.submissionMode === "save" ? "draft" : "scheduled";
  return buildMeetingRecord(
    { ...input, status, minutes: "", actionItems: [], notifications: { inviteSent: input.submissionMode === "submit", reminderSent: false, changeNotified: false } },
    { ownerUserId }
  );
}

export function updateMeetingRecord(meeting: MeetingRecord, input: UpdateMeetingInput): MeetingRecord {
  return buildMeetingRecord(input, {
    id: meeting.id,
    createdAt: meeting.createdAt,
    ownerUserId: meeting.ownerUserId,
    submittedAt: input.status === "draft" ? meeting.submittedAt : meeting.submittedAt || new Date().toISOString(),
  });
}

export function selectWorkflowTemplate(
  meeting: MeetingRecord,
  templates: ProductWorkflowTemplate[],
  templateId?: string
) {
  return (
    (templateId ? templates.find((t) => t.id === templateId) : null) ??
    templates.find((t) => t.category === meeting.type) ??
    templates[0]
  );
}

export async function createWorkflowRun(meeting: MeetingRecord, template: ProductWorkflowTemplate) {
  return executeWorkflowRun(meeting, template);
}

export function attachPermissions(meeting: MeetingRecord, user?: PublicUser): MeetingRecordWithPermissions {
  return {
    ...meeting,
    permissions: user ? buildPermissions(user, meeting) : { canCreate: false, canEdit: false, canCancel: false, canDelete: false, canViewMinutes: false },
  };
}

export function attachPermissionsToItems(items: MeetingRecord[], user?: PublicUser): MeetingRecordWithPermissions[] {
  return items.map((item) => attachPermissions(item, user));
}

// ── Memory helpers ──

export function canAccessMemory(memory: MeetingMemory, user: PublicUser, ctx: AppContext) {
  if (user.role === "admin") return true;
  if (memory.visibility === "private" && memory.ownerUserId !== user.id) return false;
  const meeting = ctx.meetings.find((m) => m.id === memory.meetingId);
  return meeting ? buildPermissions(user, meeting).canViewMinutes : memory.ownerUserId === user.id;
}

export function canManageMemory(memory: MeetingMemory, user: PublicUser, ctx: AppContext) {
  if (user.role === "admin" || memory.ownerUserId === user.id) return true;
  const meeting = ctx.meetings.find((m) => m.id === memory.meetingId);
  return meeting ? buildPermissions(user, meeting).canEdit : false;
}

export function scoreMemoryForMeeting(memory: MeetingMemory, meeting?: MeetingRecord) {
  if (!meeting) return new Date(memory.updatedAt).getTime();
  let score = 0;
  if (memory.meetingId === meeting.id) score += 1000;
  if (memory.meetingType === meeting.type) score += 240;
  if (memory.meetingTitle === meeting.title) score += 160;
  const tagSet = new Set(meeting.tags);
  score += memory.tags.filter((tag) => tagSet.has(tag)).length * 40;
  const participantSet = new Set(meeting.participants.map((p) => p.name));
  score += memory.relatedParticipantNames.filter((name) => participantSet.has(name)).length * 24;
  if (memory.kind === "action_item") score += 32;
  if (memory.kind === "risk") score += 26;
  if (memory.isPinned) score += 500;
  score += Math.round(memory.confidence * 30);
  return score;
}

// ── Workflow writeback helpers ──

export function getTextOutput(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === undefined || value === null ? "" : String(value);
}

export function buildMeetingWriteback(meeting: MeetingRecord, run: ProductWorkflowRun): MeetingRecord | null {
  const agendaTitles = new Set(meeting.agendaItems.map((a) => a.title));
  const actionContents = new Set(meeting.actionItems.map((a) => a.content));
  const nextAgendaItems = [...meeting.agendaItems];
  const nextActionItems = [...meeting.actionItems];
  const minuteLines: string[] = [];

  for (const nodeRun of run.nodeRuns) {
    const structuredOutput = nodeRun.outputPayload?.structuredOutput;
    if (!structuredOutput || typeof structuredOutput !== "object" || Array.isArray(structuredOutput)) continue;
    const output = structuredOutput as Record<string, unknown>;
    const agendaDraft = getTextOutput(output.agendaDraft);
    if (agendaDraft && !agendaTitles.has(agendaDraft)) {
      agendaTitles.add(agendaDraft);
      nextAgendaItems.push({ id: `agenda-${run.id}-${nodeRun.nodeId}`, title: agendaDraft.slice(0, 120), completed: false });
    }
    for (const key of ["prepNotes", "routeDecision", "contextPack"]) {
      const text = getTextOutput(output[key]);
      if (text) minuteLines.push(`[${nodeRun.nodeId}] ${key}: ${text.slice(0, 240)}`);
    }
    const actionOutput = output.actionItems;
    const items = Array.isArray(actionOutput) ? actionOutput : typeof actionOutput === "string" ? [actionOutput] : [];
    items.slice(0, 5).forEach((item, index) => {
      const content = getTextOutput(item).slice(0, 160);
      if (!content || actionContents.has(content)) return;
      actionContents.add(content);
      nextActionItems.push({ id: `action-${run.id}-${nodeRun.nodeId}-${index}`, content, owner: meeting.owner, dueDate: "", status: "todo" });
    });
  }

  if (nextAgendaItems.length === meeting.agendaItems.length && nextActionItems.length === meeting.actionItems.length && minuteLines.length === 0) return null;

  return { ...meeting, agendaItems: nextAgendaItems, actionItems: nextActionItems, minutes: [meeting.minutes.trim(), ...minuteLines].filter(Boolean).join("\n"), updatedAt: new Date().toISOString() };
}

export async function persistWorkflowMeetingWriteback(meeting: MeetingRecord, run: ProductWorkflowRun, ctx: AppContext) {
  if (run.status !== "completed") return meeting;

  let updated = meeting;

  if (run.runtimeSnapshot) {
    const fromRuntime = applyMeetingRuntimeWriteback(updated, run.runtimeSnapshot);
    if (fromRuntime) {
      updated = fromRuntime;
    }
  }

  const fromStructured = buildMeetingWriteback(updated, run);
  if (fromStructured) {
    updated = fromStructured;
  }

  for (const nodeRun of run.nodeRuns) {
    const externalCalendar = nodeRun.outputPayload?.externalCalendar;
    if (externalCalendar && typeof externalCalendar === "object" && !Array.isArray(externalCalendar)) {
      const calendar = externalCalendar as MeetingRecord["externalCalendar"];
      updated = {
        ...updated,
        externalCalendar: calendar,
        meetingLink: calendar?.hangoutLink || updated.meetingLink,
        updatedAt: new Date().toISOString()
      };
    }
  }

  if (updated === meeting) {
    return meeting;
  }

  ctx.meetings = ctx.meetings.map((item) => (item.id === meeting.id ? updated : item));
  await saveMeetings(ctx.meetings);
  return updated;
}

// ── Memory persistence helpers ──

function getMemorySource(meeting: MeetingRecord) {
  return `${meeting.title} / ${new Date(meeting.startAt).toLocaleDateString("zh-CN")}`;
}

function normalizeMemoryTags(meeting: MeetingRecord) {
  return [...new Set([meeting.type, meeting.priority, ...meeting.tags].filter(Boolean))];
}

export function buildWorkflowMemories(meeting: MeetingRecord, run: ProductWorkflowRun): MeetingMemory[] {
  const now = new Date().toISOString();
  const source = getMemorySource(meeting);
  const tags = normalizeMemoryTags(meeting);
  const relatedParticipantNames = meeting.participants.map((p) => p.name);
  const blockedNode = run.nodeRuns.find((nr) => nr.status === "blocked" || nr.errorMessage);
  const completedActionItems = meeting.actionItems.filter((a) => a.status === "completed").length;
  const openActionItems = meeting.actionItems.filter((a) => a.status !== "completed");

  const base = { meetingId: meeting.id, meetingTitle: meeting.title, meetingType: meeting.type, ownerUserId: meeting.ownerUserId, sourceRunId: run.id, source, visibility: "team" as const, tags, relatedParticipantNames, isPinned: false, createdAt: now, updatedAt: now };

  const memories: MeetingMemory[] = [
    { ...base, id: `memory-${run.id}-summary`, kind: "summary", content: `会议目标：${meeting.meetingGoal}。本次流程状态为「${run.status}」，议程 ${meeting.agendaItems.length} 项，行动项 ${meeting.actionItems.length} 项，其中 ${completedActionItems} 项已完成。`, confidence: 0.86 },
  ];

  if (meeting.minutes.trim()) {
    memories.push({ ...base, id: `memory-${run.id}-decision`, kind: "decision", content: meeting.minutes.trim().slice(0, 260), confidence: 0.82 });
  }

  if (blockedNode?.errorMessage) {
    memories.push({ ...base, id: `memory-${run.id}-risk`, kind: "risk", content: `历史阻塞：${blockedNode.errorMessage}`, confidence: 0.9 });
  }

  for (const actionItem of openActionItems.slice(0, 6)) {
    memories.push({ ...base, id: `memory-${run.id}-action-${actionItem.id}`, kind: "action_item", content: `${actionItem.owner}：${actionItem.content}${actionItem.dueDate ? `，截止 ${actionItem.dueDate}` : ""}，当前状态 ${actionItem.status}`, confidence: 0.88 });
  }

  return memories;
}

export async function persistWorkflowMemories(meeting: MeetingRecord, run: ProductWorkflowRun, ctx: AppContext) {
  if (!["completed", "blocked"].includes(run.status)) return [];
  const nextMemories = buildWorkflowMemories(meeting, run);
  const nextIds = new Set(nextMemories.map((m) => m.id));
  ctx.meetingMemories = [...nextMemories, ...ctx.meetingMemories.filter((m) => !nextIds.has(m.id))].sort(sortMemoriesByUpdatedAtDesc);
  await saveMeetingMemories(ctx.meetingMemories, ctx.meetings);
  return nextMemories;
}

// ── App/node agent helpers ──

export function normalizeDebugInputs(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function validateApplicationInputs(
  application: ReturnType<typeof buildAiApplicationsFromTemplates>[number],
  inputs: Record<string, unknown>
) {
  const missingFields = application.inputSchema
    .filter((f) => f.required)
    .filter((f) => {
      const v = inputs[f.key];
      return v === undefined || v === null || (typeof v === "string" && !v.trim());
    })
    .map((f) => f.label);
  if (missingFields.length > 0) return `缺少必填输入：${missingFields.join("、")}`;

  for (const field of application.inputSchema) {
    const value = inputs[field.key];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "number" && Number.isNaN(Number(value))) return `${field.label} 必须是数字`;
    if (field.type === "json" && typeof value === "string") {
      try { JSON.parse(value); } catch { return `${field.label} 必须是有效 JSON`; }
    }
    if (field.type === "select" && field.options?.length && !field.options.includes(String(value))) return `${field.label} 不在可选范围内`;
  }
  return "";
}

export function getNodeApplicationBinding(appId: string, templates: ProductWorkflowTemplate[]) {
  const application = buildAiApplicationsFromTemplates(templates).find((a) => a.id === appId);
  const template = application ? templates.find((t) => t.id === application.templateId) : undefined;
  const node = application?.source === "node" && application.nodeId ? template?.nodes.find((n) => n.id === application.nodeId) : undefined;
  return { application, template, node };
}

export function buildNodeAgentVersion(
  application: ReturnType<typeof buildAiApplicationsFromTemplates>[number],
  template: ProductWorkflowTemplate,
  node: ProductWorkflowTemplate["nodes"][number],
  status: AiApplicationVersion["status"],
  summary: string,
  createdBy: string
): AiApplicationVersion {
  const createdAt = new Date().toISOString();
  const versionIndex = (node.agentVersions?.length ?? 0) + 1;
  return {
    id: `${application.id}-version-${Date.now()}`,
    version: `v${versionIndex}`,
    applicationId: application.id,
    templateId: template.id,
    nodeId: node.id,
    name: application.name,
    status,
    summary,
    createdBy,
    createdAt,
    inputSchema: application.inputSchema,
    outputSchema: application.outputSchema,
    promptConfig: application.promptConfig,
    executor: node.executor ?? { type: "aiApplication", applicationId: application.id, label: application.name, runtime: "agent", inputMapping: {}, outputMapping: {} },
  };
}

import { z } from "zod";

export const meetingNodeKinds = [
  "trigger",
  "ai",
  "decision",
  "action",
  "knowledge"
] as const;

export const meetingNodeKindSchema = z.enum(meetingNodeKinds);
export type MeetingNodeKind = z.infer<typeof meetingNodeKindSchema>;

export const meetingNodeKindLabels: Record<MeetingNodeKind, string> = {
  trigger: "触发",
  ai: "AI",
  decision: "决策",
  action: "执行",
  knowledge: "知识"
};

export const workflowStepSchema = z.object({
  id: z.string(),
  kind: meetingNodeKindSchema,
  title: z.string(),
  summary: z.string(),
  x: z.number(),
  y: z.number()
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowConnectionSchema = z.object({
  source: z.string(),
  target: z.string()
});

export type WorkflowConnection = z.infer<typeof workflowConnectionSchema>;

export const workflowBlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(workflowStepSchema),
  connections: z.array(workflowConnectionSchema)
});

export type WorkflowBlueprint = z.infer<typeof workflowBlueprintSchema>;

export const meetingChannelValues = ["zoom", "teams", "meet"] as const;
export const meetingChannelSchema = z.enum(meetingChannelValues);
export type MeetingChannel = z.infer<typeof meetingChannelSchema>;

export const meetingStatusValues = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled"
] as const;
export const meetingStatusSchema = z.enum(meetingStatusValues);
export type MeetingStatus = z.infer<typeof meetingStatusSchema>;

export const meetingPriorityValues = ["low", "medium", "high", "critical"] as const;
export const meetingPrioritySchema = z.enum(meetingPriorityValues);
export type MeetingPriority = z.infer<typeof meetingPrioritySchema>;

export const meetingTypeValues = [
  "weekly",
  "project",
  "interview",
  "client",
  "review",
  "other"
] as const;
export const meetingTypeSchema = z.enum(meetingTypeValues);
export type MeetingType = z.infer<typeof meetingTypeSchema>;

export const participantRoleValues = ["host", "recorder", "attendee"] as const;
export const participantRoleSchema = z.enum(participantRoleValues);
export type ParticipantRole = z.infer<typeof participantRoleSchema>;

export const participantStatusValues = ["pending", "accepted", "declined"] as const;
export const participantStatusSchema = z.enum(participantStatusValues);
export type ParticipantStatus = z.infer<typeof participantStatusSchema>;

export const actionItemStatusValues = ["todo", "in_progress", "completed"] as const;
export const actionItemStatusSchema = z.enum(actionItemStatusValues);
export type ActionItemStatus = z.infer<typeof actionItemStatusSchema>;

export const createMeetingModeValues = ["save", "submit"] as const;
export const createMeetingModeSchema = z.enum(createMeetingModeValues);
export type CreateMeetingMode = z.infer<typeof createMeetingModeSchema>;

export const meetingChannelLabels: Record<MeetingChannel, string> = {
  zoom: "Zoom",
  teams: "Microsoft Teams",
  meet: "Google Meet"
};

export const meetingStatusLabels: Record<MeetingStatus, string> = {
  draft: "草稿",
  scheduled: "待开始",
  in_progress: "进行中",
  completed: "已结束",
  cancelled: "已取消"
};

export const meetingPriorityLabels: Record<MeetingPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急"
};

export const meetingTypeLabels: Record<MeetingType, string> = {
  weekly: "周会",
  project: "项目会",
  interview: "面试",
  client: "客户沟通",
  review: "评审会",
  other: "其他"
};

export const participantRoleLabels: Record<ParticipantRole, string> = {
  host: "主持人",
  recorder: "记录人",
  attendee: "普通参会者"
};

export const participantStatusLabels: Record<ParticipantStatus, string> = {
  pending: "待确认",
  accepted: "已接受",
  declined: "已拒绝"
};

export const actionItemStatusLabels: Record<ActionItemStatus, string> = {
  todo: "未开始",
  in_progress: "进行中",
  completed: "已完成"
};

// ── Auth types ──

export const userRoleValues = ["admin", "editor", "viewer"] as const;
export const userRoleSchema = z.enum(userRoleValues);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userRoleLabels: Record<UserRole, string> = {
  admin: "管理员",
  editor: "编辑者",
  viewer: "观察者"
};

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  passwordHash: z.string(),
  role: userRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
export type User = z.infer<typeof userSchema>;

export const publicUserSchema = userSchema.omit({ passwordHash: true });
export type PublicUser = z.infer<typeof publicUserSchema>;

export const loginInputSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少 6 位")
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const registerInputSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少 6 位"),
  name: z.string().min(1, "姓名不能为空")
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

// ── Meeting participant input ──

export const meetingParticipantInputSchema = z.object({
  name: z.string().min(1, "参会人姓名不能为空"),
  role: participantRoleSchema,
  status: participantStatusSchema
});

export type MeetingParticipantInput = z.infer<typeof meetingParticipantInputSchema>;

export const meetingParticipantSchema = meetingParticipantInputSchema.extend({
  id: z.string()
});

export type MeetingParticipant = z.infer<typeof meetingParticipantSchema>;

export const meetingAgendaItemInputSchema = z.object({
  title: z.string().min(1, "议程项不能为空"),
  completed: z.boolean().default(false)
});

export type MeetingAgendaItemInput = z.infer<typeof meetingAgendaItemInputSchema>;

export const meetingAgendaItemSchema = meetingAgendaItemInputSchema.extend({
  id: z.string()
});

export type MeetingAgendaItem = z.infer<typeof meetingAgendaItemSchema>;

export const meetingActionItemInputSchema = z.object({
  content: z.string().min(1, "待办内容不能为空"),
  owner: z.string().min(1, "负责人不能为空"),
  dueDate: z.string().default(""),
  status: actionItemStatusSchema
});

export type MeetingActionItemInput = z.infer<typeof meetingActionItemInputSchema>;

export const meetingActionItemSchema = meetingActionItemInputSchema.extend({
  id: z.string()
});

export type MeetingActionItem = z.infer<typeof meetingActionItemSchema>;

export const meetingNotificationStateSchema = z.object({
  inviteSent: z.boolean(),
  reminderSent: z.boolean(),
  changeNotified: z.boolean()
});

export type MeetingNotificationState = z.infer<typeof meetingNotificationStateSchema>;

export const externalCalendarProviderValues = ["google", "feishu", "mock"] as const;
export const externalCalendarProviderSchema = z.enum(externalCalendarProviderValues);
export type ExternalCalendarProvider = z.infer<typeof externalCalendarProviderSchema>;

export const meetingExternalCalendarSchema = z.object({
  provider: externalCalendarProviderSchema,
  eventId: z.string(),
  htmlLink: z.string().default(""),
  hangoutLink: z.string().default(""),
  syncedAt: z.string()
});

export type MeetingExternalCalendar = z.infer<typeof meetingExternalCalendarSchema>;

export const meetingPermissionsSchema = z.object({
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canCancel: z.boolean(),
  canDelete: z.boolean(),
  canViewMinutes: z.boolean()
});

export type MeetingPermissions = z.infer<typeof meetingPermissionsSchema>;

export const editableMeetingSchema = z.object({
  title: z.string().min(3, "会议标题至少 3 个字符"),
  type: meetingTypeSchema,
  tags: z.array(z.string().min(1)).default([]),
  host: z.string().min(2, "组织者至少 2 个字符"),
  owner: z.string().min(2, "记录人至少 2 个字符"),
  description: z.string().min(5, "会议描述至少 5 个字符"),
  meetingGoal: z.string().min(5, "会议目标至少 5 个字符"),
  channel: meetingChannelSchema,
  startAt: z.string().min(1, "请选择开始时间"),
  endAt: z.string().min(1, "请选择结束时间"),
  priority: meetingPrioritySchema,
  status: meetingStatusSchema.default("draft"),
  location: z.string().default(""),
  meetingLink: z.string().default(""),
  isRecurring: z.boolean().default(false),
  recurrence: z.string().default(""),
  participants: z.array(meetingParticipantInputSchema).min(1, "至少添加 1 位参会人"),
  agendaItems: z.array(meetingAgendaItemInputSchema).default([]),
  notes: z.string().default(""),
  minutes: z.string().default(""),
  actionItems: z.array(meetingActionItemInputSchema).default([]),
  notifications: meetingNotificationStateSchema.default({
    inviteSent: false,
    reminderSent: false,
    changeNotified: false
  })
});

export type EditableMeetingInput = z.infer<typeof editableMeetingSchema>;

export const meetingRecordSchema = editableMeetingSchema.extend({
  id: z.string(),
  ownerUserId: z.string().default(""),
  participants: z.array(meetingParticipantSchema),
  agendaItems: z.array(meetingAgendaItemSchema),
  actionItems: z.array(meetingActionItemSchema),
  attendeeCount: z.number().int().nonnegative(),
  durationMinutes: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().default(""),
  externalCalendar: meetingExternalCalendarSchema.optional()
});

export type MeetingRecord = z.infer<typeof meetingRecordSchema>;

export const meetingRecordWithPermissionsSchema = meetingRecordSchema.extend({
  permissions: meetingPermissionsSchema
});
export type MeetingRecordWithPermissions = z.infer<typeof meetingRecordWithPermissionsSchema>;

export const createMeetingSchema = editableMeetingSchema
  .omit({
    status: true,
    minutes: true,
    actionItems: true,
    notifications: true
  })
  .extend({
    submissionMode: createMeetingModeSchema.default("submit")
  });

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = editableMeetingSchema;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

export const updateMeetingStatusSchema = z.object({
  status: meetingStatusSchema
});

export type UpdateMeetingStatusInput = z.infer<typeof updateMeetingStatusSchema>;

export const meetingDashboardSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  scheduled: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative()
});

export type MeetingDashboardSummary = z.infer<typeof meetingDashboardSummarySchema>;

export const meetingMemoryKindValues = [
  "summary",
  "decision",
  "action_item",
  "risk",
  "preference"
] as const;
export const meetingMemoryKindSchema = z.enum(meetingMemoryKindValues);
export type MeetingMemoryKind = z.infer<typeof meetingMemoryKindSchema>;

export const meetingMemoryKindLabels: Record<MeetingMemoryKind, string> = {
  summary: "会议摘要",
  decision: "决策记录",
  action_item: "行动项",
  risk: "风险提示",
  preference: "偏好记忆"
};

export const meetingMemoryVisibilityValues = ["private", "team", "organization"] as const;
export const meetingMemoryVisibilitySchema = z.enum(meetingMemoryVisibilityValues);
export type MeetingMemoryVisibility = z.infer<typeof meetingMemoryVisibilitySchema>;

export const meetingMemorySchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  meetingTitle: z.string(),
  meetingType: meetingTypeSchema,
  ownerUserId: z.string().default(""),
  sourceRunId: z.string().default(""),
  kind: meetingMemoryKindSchema,
  content: z.string(),
  source: z.string(),
  visibility: meetingMemoryVisibilitySchema,
  confidence: z.number().min(0).max(1),
  isPinned: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  relatedParticipantNames: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().optional()
});

export type MeetingMemory = z.infer<typeof meetingMemorySchema>;

export const meetingAgentActionKindValues = [
  "start_workflow",
  "advance_blocker",
  "sync_calendar",
  "prepare_agenda",
  "review_memory",
  "update_meeting",
  "none"
] as const;

export const meetingAgentActionKindSchema = z.enum(meetingAgentActionKindValues);
export type MeetingAgentActionKind = z.infer<typeof meetingAgentActionKindSchema>;

export const meetingAgentActionPriorityValues = ["low", "medium", "high", "critical"] as const;
export const meetingAgentActionPrioritySchema = z.enum(meetingAgentActionPriorityValues);
export type MeetingAgentActionPriority = z.infer<typeof meetingAgentActionPrioritySchema>;

export const meetingAgentInsightKindValues = ["risk", "opportunity", "context", "automation"] as const;
export const meetingAgentInsightKindSchema = z.enum(meetingAgentInsightKindValues);
export type MeetingAgentInsightKind = z.infer<typeof meetingAgentInsightKindSchema>;

export const meetingAgentActionSchema = z.object({
  id: z.string(),
  kind: meetingAgentActionKindSchema,
  title: z.string(),
  description: z.string(),
  priority: meetingAgentActionPrioritySchema,
  confidence: z.number().min(0).max(1),
  targetId: z.string().default(""),
  payload: z.record(z.string(), z.string()).default({})
});

export type MeetingAgentAction = z.infer<typeof meetingAgentActionSchema>;

export const meetingAgentInsightSchema = z.object({
  id: z.string(),
  kind: meetingAgentInsightKindSchema,
  title: z.string(),
  description: z.string(),
  evidence: z.array(z.string()).default([])
});

export type MeetingAgentInsight = z.infer<typeof meetingAgentInsightSchema>;

export const meetingAgentTraceStepSchema = z.object({
  id: z.string(),
  tool: z.string(),
  input: z.string(),
  output: z.string()
});

export type MeetingAgentTraceStep = z.infer<typeof meetingAgentTraceStepSchema>;

export const meetingAgentRunSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  templateId: z.string().default(""),
  workflowRunId: z.string().default(""),
  executionStatus: z.enum(["not_started", "queued", "running", "blocked", "completed", "failed"]).default("not_started"),
  createdAt: z.string(),
  status: z.enum(["completed", "degraded"]),
  summary: z.string(),
  model: z.string(),
  actions: z.array(meetingAgentActionSchema),
  insights: z.array(meetingAgentInsightSchema),
  trace: z.array(meetingAgentTraceStepSchema)
});

export type MeetingAgentRun = z.infer<typeof meetingAgentRunSchema>;

export const meetingIntakeSchema = createMeetingSchema.pick({
  title: true,
  host: true,
  meetingGoal: true,
  channel: true,
  participants: true
});

export type MeetingIntake = z.infer<typeof meetingIntakeSchema>;

export const meetingNodeCatalog: Array<{
  kind: MeetingNodeKind;
  title: string;
  summary: string;
}> = [
  {
    kind: "trigger",
    title: "会议发起",
    summary: "接收会议申请，并将原始需求整理为统一的输入格式。"
  },
  {
    kind: "ai",
    title: "议程生成",
    summary: "根据会议目标生成议程草案、风险提示和建议参会人。"
  },
  {
    kind: "knowledge",
    title: "上下文检索",
    summary: "拉取 CRM 记录、历史纪要和项目进展等上下文信息。"
  },
  {
    kind: "decision",
    title: "规则校验",
    summary: "根据紧急程度、参会规模和审批规则进行分支判断。"
  },
  {
    kind: "action",
    title: "结果分发",
    summary: "发送通知、纪要和后续任务到下游系统。"
  }
];

export const defaultWorkflowBlueprint: WorkflowBlueprint = {
  id: "meeting-orchestrator",
  name: "智能会议编排流程",
  description: "一个面向会前准备、会中协作和会后执行的可视化自动化画布。",
  steps: [
    {
      id: "intake",
      kind: "trigger",
      title: "会议申请触发",
      summary: "接收来自产品、销售或运营团队的新会议申请。",
      x: 120,
      y: 140
    },
    {
      id: "agenda",
      kind: "ai",
      title: "生成会议议程",
      summary: "把会议目标整理为议程、讨论要点和成功标准。",
      x: 380,
      y: 140
    },
    {
      id: "context",
      kind: "knowledge",
      title: "收集上下文",
      summary: "汇总历史纪要、任务状态、客户信息与当前阻塞。",
      x: 640,
      y: 140
    },
    {
      id: "policy",
      kind: "decision",
      title: "合规与规则审核",
      summary: "检查参会人数阈值、保密等级与审批要求。",
      x: 900,
      y: 140
    },
    {
      id: "dispatch",
      kind: "action",
      title: "同步执行结果",
      summary: "发送邀请、创建待办任务，并通知相关负责人。",
      x: 1160,
      y: 140
    }
  ],
  connections: [
    { source: "intake", target: "agenda" },
    { source: "agenda", target: "context" },
    { source: "context", target: "policy" },
    { source: "policy", target: "dispatch" }
  ]
};

export type WorkflowNodeConfigField = {
  key: string;
  label: string;
  value: string;
  kind: "text" | "select" | "textarea" | "toggle";
};

export type ProductWorkflowNodeExecutor = {
  type: "aiApplication" | "system" | "manual";
  applicationId?: string;
  label: string;
  runtime: "agent" | "workflow" | "system" | "human";
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
};

export type ProductWorkflowNode = {
  id: string;
  kind: MeetingNodeKind;
  title: string;
  description: string;
  position: { x: number; y: number };
  owner: string;
  inputs: string[];
  outputs: string[];
  configFields: WorkflowNodeConfigField[];
  executor?: ProductWorkflowNodeExecutor;
  agentInputSchema?: AiApplicationInputField[];
  agentOutputSchema?: AiApplicationOutputField[];
  agentPromptConfig?: AiApplicationPromptConfig;
  agentVersions?: AiApplicationVersion[];
};

export type ProductWorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  condition?: string;
  dataMapping?: Record<string, string>;
};

export type ProductWorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: MeetingType;
  status: "draft" | "published";
  nodes: ProductWorkflowNode[];
  edges: ProductWorkflowEdge[];
  updatedAt: string;
};

export type ProductWorkflowRunStatus = "queued" | "running" | "blocked" | "completed" | "failed";
export type ProductNodeRunStatus = "pending" | "running" | "success" | "blocked" | "failed" | "skipped";

export type ProductRunLog = {
  id: string;
  time: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  nodeId?: string;
};

export type ProductNodeRun = {
  nodeId: string;
  status: ProductNodeRunStatus;
  startedAt?: string;
  endedAt?: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  errorMessage?: string;
};

export type ProductWorkflowRun = {
  id: string;
  templateId: string;
  meetingId: string;
  name: string;
  status: ProductWorkflowRunStatus;
  durationSeconds: number;
  startedAt: string;
  endedAt?: string;
  configSnapshot?: Array<{
    nodeId: string;
    nodeTitle: string;
    configFields: WorkflowNodeConfigField[];
  }>;
  nodeRuns: ProductNodeRun[];
  logs: ProductRunLog[];
};

export type AiApplicationMode = "workflow" | "chatflow" | "agent";
export type AiApplicationStatus = "draft" | "published";
export type AiApplicationInputType = "text" | "textarea" | "number" | "select" | "json" | "boolean";

export type AiApplicationInputField = {
  key: string;
  label: string;
  type: AiApplicationInputType;
  required: boolean;
  description: string;
  defaultValue: string;
  options?: string[];
};

export type AiApplicationOutputField = {
  key: string;
  label: string;
  type: "text" | "json" | "number" | "boolean";
  description: string;
};

export type AiApplicationPromptConfig = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
};

export type AiApplicationVersion = {
  id: string;
  version: string;
  applicationId: string;
  templateId: string;
  nodeId: string;
  name: string;
  status: "snapshot" | "published";
  summary: string;
  createdBy: string;
  createdAt: string;
  inputSchema: AiApplicationInputField[];
  outputSchema: AiApplicationOutputField[];
  promptConfig: AiApplicationPromptConfig;
  executor: ProductWorkflowNodeExecutor;
};

export type MiniDifyNodeCapability = {
  kind: MeetingNodeKind;
  name: string;
  difyLikeName: string;
  purpose: string;
  requiredConfig: string[];
  runtimeOutput: string[];
  maturity: "ready" | "partial" | "planned";
};

export type AiApplication = {
  id: string;
  name: string;
  description: string;
  mode: AiApplicationMode;
  status: AiApplicationStatus;
  source: "workflow" | "node";
  templateId: string;
  nodeId?: string;
  nodeKind?: MeetingNodeKind;
  category: MeetingType;
  entrypoint: string;
  apiEndpoint: string;
  modelProvider: "anthropic" | "mock";
  inputSchema: AiApplicationInputField[];
  outputSchema: AiApplicationOutputField[];
  promptConfig: AiApplicationPromptConfig;
  versions: AiApplicationVersion[];
  capabilities: MeetingNodeKind[];
  publishedAt: string;
  updatedAt: string;
};

export function buildNodeAgentApplicationId(templateId: string, nodeId: string) {
  return `agent-${templateId.replace(/^template-/, "")}-${nodeId}`;
}

function buildNodeExecutor(templateId: string, node: Pick<ProductWorkflowNode, "id" | "kind" | "inputs" | "outputs">): ProductWorkflowNodeExecutor {
  const runtimeByKind: Record<MeetingNodeKind, ProductWorkflowNodeExecutor["runtime"]> = {
    action: "system",
    ai: "agent",
    decision: "agent",
    knowledge: "agent",
    trigger: "system"
  };

  return {
    type: node.kind === "trigger" || node.kind === "action" ? "system" : "aiApplication",
    applicationId:
      node.kind === "trigger" || node.kind === "action" ? undefined : buildNodeAgentApplicationId(templateId, node.id),
    label: node.kind === "trigger" || node.kind === "action" ? "系统执行器" : "节点智能体",
    runtime: runtimeByKind[node.kind],
    inputMapping: Object.fromEntries(node.inputs.map((input) => [input, `meeting.${input}`])),
    outputMapping: Object.fromEntries(node.outputs.map((output) => [output, `node.${node.id}.${output}`]))
  };
}

export function ensureProductWorkflowNodeExecutors(template: ProductWorkflowTemplate): ProductWorkflowTemplate {
  return {
    ...template,
    nodes: template.nodes.map((node) => ({
      ...node,
      executor: node.executor ?? buildNodeExecutor(template.id, node)
    }))
  };
}

function buildNodeAgentInputSchema(node: ProductWorkflowNode): AiApplicationInputField[] {
  if (node.agentInputSchema?.length) {
    return node.agentInputSchema;
  }

  return [
    defaultMeetingAppInputSchema[0],
    ...node.inputs.map((input) => ({
      key: input,
      label: input,
      type: "textarea" as const,
      required: false,
      description: `映射到 ${node.title} 节点的输入变量。`,
      defaultValue: ""
    }))
  ];
}

function buildNodeAgentOutputSchema(node: ProductWorkflowNode): AiApplicationOutputField[] {
  if (node.agentOutputSchema?.length) {
    return node.agentOutputSchema;
  }

  return node.outputs.map((output) => ({
    key: output,
    label: output,
    type: inferNodeAgentOutputType(output),
    description: `${node.title} 节点写回流程上下文的输出。`
  }));
}

function inferNodeAgentOutputType(output: string): AiApplicationOutputField["type"] {
  const normalized = output.toLowerCase();

  if (normalized.includes("count") || normalized.includes("tokens")) {
    return "number";
  }

  if (normalized.includes("ready") || normalized.startsWith("is") || normalized.startsWith("has")) {
    return "boolean";
  }

  if (normalized.includes("decision") || normalized.includes("draft") || normalized.includes("notes") || normalized.includes("request")) {
    return "text";
  }

  return "json";
}

function buildNodeAgentPromptConfig(node: ProductWorkflowNode): AiApplicationPromptConfig {
  if (node.agentPromptConfig) {
    return node.agentPromptConfig;
  }

  const inputLines = node.inputs.map((input) => `- ${input}: {{input.${input}}}`).join("\n");
  const outputLines = node.outputs.map((output) => `- ${output}`).join("\n");

  return {
    systemPrompt: `你是会议流程中的「${node.title}」节点智能体。请只完成该节点动作，并按输出字段返回结构化结果。`,
    userPrompt: [
      "会议目标：{{meeting.meetingGoal}}",
      "会议标题：{{meeting.title}}",
      "优先级：{{meeting.priority}}",
      "",
      "节点输入：",
      inputLines || "- meetingId: {{meeting.meetingId}}",
      "",
      "需要产出的字段：",
      outputLines || "- output",
      "",
      "请返回简洁、可被流程继续消费的结果。"
    ].join("\n"),
    model: "claude-sonnet-4",
    temperature: 0.2,
    maxTokens: 1024
  };
}

export const defaultMeetingAppInputSchema: AiApplicationInputField[] = [
  {
    key: "meetingId",
    label: "会议 ID",
    type: "text",
    required: true,
    description: "作为本次应用运行的业务对象，当前执行器会用它加载会议上下文。",
    defaultValue: "meeting-001"
  },
  {
    key: "meetingGoal",
    label: "会议目标",
    type: "textarea",
    required: true,
    description: "传入 LLM 节点的主要目标变量。",
    defaultValue: ""
  },
  {
    key: "priority",
    label: "优先级",
    type: "select",
    required: true,
    description: "用于规则分支和审批策略。",
    defaultValue: "medium",
    options: [...meetingPriorityValues]
  },
  {
    key: "participants",
    label: "参会人",
    type: "json",
    required: false,
    description: "参会人数组，可被 AI 节点用来推断角色和议程。",
    defaultValue: "[]"
  }
];

export const defaultMeetingAppOutputSchema: AiApplicationOutputField[] = [
  {
    key: "run",
    label: "运行结果",
    type: "json",
    description: "工作流运行记录，包含状态、节点输出和日志。"
  },
  {
    key: "memoryCount",
    label: "沉淀记忆数",
    type: "number",
    description: "本次运行沉淀到会议记忆库的条目数。"
  }
];

export const miniDifyNodeCapabilityCatalog: MiniDifyNodeCapability[] = [
  {
    kind: "trigger",
    name: "触发器",
    difyLikeName: "Start",
    purpose: "接收外部请求、会议申请或调度事件，并生成统一运行输入。",
    requiredConfig: ["event", "input schema", "dedupe policy"],
    runtimeOutput: ["run input", "meeting request"],
    maturity: "ready"
  },
  {
    kind: "ai",
    name: "LLM",
    difyLikeName: "LLM",
    purpose: "调用模型执行提示词，把会议目标、上下文和变量转换为结构化输出。",
    requiredConfig: ["model", "prompt", "temperature"],
    runtimeOutput: ["text", "structured fields", "token usage"],
    maturity: "partial"
  },
  {
    kind: "knowledge",
    name: "知识检索",
    difyLikeName: "Knowledge Retrieval",
    purpose: "从纪要、项目文档或业务系统中召回运行上下文。",
    requiredConfig: ["sources", "max docs", "missing policy"],
    runtimeOutput: ["context pack", "citations"],
    maturity: "partial"
  },
  {
    kind: "decision",
    name: "条件分支",
    difyLikeName: "IF/ELSE",
    purpose: "基于运行变量、规则表达式和审批策略控制流程走向。",
    requiredConfig: ["condition", "approver", "timeout"],
    runtimeOutput: ["route decision", "blocked reason"],
    maturity: "ready"
  },
  {
    kind: "action",
    name: "工具调用",
    difyLikeName: "Tool",
    purpose: "把运行结果同步到日历、通知渠道、任务系统或外部 API。",
    requiredConfig: ["channels", "retry", "output mapping"],
    runtimeOutput: ["tool result", "side effects"],
    maturity: "partial"
  }
];

export const productAudienceSchema = z.object({
  role: z.string(),
  job: z.string()
});

export type ProductAudience = z.infer<typeof productAudienceSchema>;

export const productModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  primaryObjects: z.array(z.string())
});

export type ProductModule = z.infer<typeof productModuleSchema>;

export const productLifecycleStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tokens: z.array(z.string())
});

export type ProductLifecycleStep = z.infer<typeof productLifecycleStepSchema>;

export const productMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string()
});

export type ProductMetric = z.infer<typeof productMetricSchema>;

export const productObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  category: z.string(),
  tagline: z.string(),
  headline: z.string(),
  subheadline: z.string(),
  problemStatement: z.string(),
  productPromise: z.string(),
  primaryObject: z.object({
    name: z.string(),
    definition: z.string(),
    recordKey: z.string()
  }),
  targetUsers: z.array(productAudienceSchema),
  modules: z.array(productModuleSchema),
  lifecycle: z.array(productLifecycleStepSchema),
  metrics: z.array(productMetricSchema),
  navigation: z.object({
    workflow: z.string(),
    capabilities: z.string(),
    console: z.string()
  }),
  actions: z.object({
    primary: z.string(),
    secondary: z.string()
  }),
  console: z.object({
    eyebrow: z.string(),
    title: z.string(),
    description: z.string()
  })
});

export type ProductObject = z.infer<typeof productObjectSchema>;

export const meetingFlowProduct: ProductObject = {
  id: "meeting-flow-studio",
  name: "Meeting Flow Studio",
  shortName: "Meeting Flow",
  category: "会议工作流自动化平台",
  tagline: "把会议从一次日程，升级为可编排、可运行、可复盘的业务流程。",
  headline: "会议流程编排工作台",
  subheadline:
    "面向产品、销售、客户成功和运营团队，把会议申请、议程生成、上下文检索、审批规则、通知分发和会后行动项放进同一张可视化流程画布。",
  problemStatement:
    "多数团队把会议当成日历事件管理，真实的准备材料、审批分支、行动项和跟进结果散落在聊天、文档和任务系统里，难以追踪和复用。",
  productPromise:
    "Meeting Flow Studio 将每场会议抽象成 Meeting Flow：一条有输入、有规则、有执行记录的业务流程，让团队能像维护自动化工作流一样维护会议协作。",
  primaryObject: {
    name: "Meeting Flow",
    definition:
      "一条围绕单场会议或会议模板运行的自动化流程，包含触发条件、上下文来源、AI 节点、审批规则、执行动作和运行日志。",
    recordKey: "meetingFlow"
  },
  targetUsers: [
    {
      role: "产品运营负责人",
      job: "把跨团队会议沉淀为稳定模板，减少重复准备和会后追踪成本。"
    },
    {
      role: "客户成功经理",
      job: "在客户会议前自动收集上下文，并把会后承诺同步到任务系统。"
    },
    {
      role: "团队协作管理员",
      job: "配置会议审批、通知、纪要和行动项规则，保证流程可审计。"
    }
  ],
  modules: [
    {
      id: "workflow-builder",
      name: "流程构建器",
      description: "用节点和连线编排触发器、AI、查询、条件、人工审批和动作。",
      primaryObjects: ["WorkflowTemplate", "ProductWorkflowNode", "ProductWorkflowEdge"]
    },
    {
      id: "meeting-queue",
      name: "会议队列",
      description: "集中查看待推进会议、负责人、优先级、议程和行动项。",
      primaryObjects: ["MeetingRecord", "MeetingParticipant", "MeetingAgendaItem"]
    },
    {
      id: "run-console",
      name: "运行控制台",
      description: "逐节点查看执行状态、阻塞原因、输入输出载荷和运行日志。",
      primaryObjects: ["ProductWorkflowRun", "ProductNodeRun", "ProductRunLog"]
    },
    {
      id: "template-library",
      name: "模板库",
      description: "按周会、客户复盘、决策评审等场景复用流程配置。",
      primaryObjects: ["ProductWorkflowTemplate", "MeetingType"]
    }
  ],
  lifecycle: [
    {
      id: "01",
      title: "捕获会议请求",
      description: "从会议申请、日程变更、表单提交或 Webhook 事件启动流程。",
      tokens: ["meeting.created", "calendar.updated", "form.submitted"]
    },
    {
      id: "02",
      title: "组装会议上下文",
      description: "拉取历史纪要、参会人、项目状态、客户记录和相关文档。",
      tokens: ["minutes", "CRM", "project brief"]
    },
    {
      id: "03",
      title: "执行规则和审批",
      description: "按参会人数、会议类型、优先级和异常路径进行分支流转。",
      tokens: ["if attendees > 5", "customer-facing", "missing context"]
    },
    {
      id: "04",
      title: "分发结果并回放",
      description: "生成通知、行动项、同步纪要，并保留可审计的运行记录。",
      tokens: ["send tasks", "sync notes", "replay run"]
    }
  ],
  metrics: [
    {
      label: "核心对象",
      value: "Meeting Flow",
      description: "会议不再只是日程，而是可版本化的流程资产。"
    },
    {
      label: "产品模块",
      value: "4",
      description: "构建器、队列、运行控制台和模板库构成完整工作台。"
    },
    {
      label: "流程节点",
      value: "6",
      description: "触发器、AI、查询、条件、人工审批和动作覆盖完整链路。"
    }
  ],
  navigation: {
    workflow: "产品画布",
    capabilities: "能力模型",
    console: "工作台"
  },
  actions: {
    primary: "创建 Meeting Flow",
    secondary: "打开工作台"
  },
  console: {
    eyebrow: "实时工作台",
    title: "把真实会议数据放进 IDE 式工作区",
    description: "队列、画布、配置面板和运行日志协同工作，服务真实会议流程，而不是展示型 Demo。"
  }
};

const commonMeetingNodes: ProductWorkflowNode[] = [
  {
    id: "intake",
    kind: "trigger",
    title: "会议申请触发",
    description: "接收会议申请，并把原始需求整理成统一输入。",
    position: { x: 80, y: 150 },
    owner: "申请入口",
    inputs: ["meetingGoal", "participants", "schedule"],
    outputs: ["meetingRequest"],
    configFields: [
      { key: "event", label: "触发事件", value: "meeting.created", kind: "select" },
      { key: "dedupe", label: "去重策略", value: "同一组织者 10 分钟内合并", kind: "text" },
      { key: "autoSubmit", label: "自动提交", value: "开启", kind: "toggle" }
    ]
  },
  {
    id: "agenda",
    kind: "ai",
    title: "生成会议议程",
    description: "根据目标、参会角色和历史模板生成议程草案。",
    position: { x: 350, y: 110 },
    owner: "AI 编排器",
    inputs: ["meetingRequest", "templateHints"],
    outputs: ["agendaDraft", "risks", "prepNotes"],
    configFields: [
      { key: "model", label: "模型", value: "会议议程助手", kind: "select" },
      { key: "prompt", label: "提示词", value: "根据会议目标、参会人和历史纪要生成一份简洁议程。", kind: "textarea" },
      { key: "temperature", label: "创造性", value: "低", kind: "select" }
    ]
  },
  {
    id: "context",
    kind: "knowledge",
    title: "加载上下文",
    description: "读取历史纪要、项目状态、客户记录和相关文档。",
    position: { x: 620, y: 150 },
    owner: "知识检索",
    inputs: ["meetingRequest", "agendaDraft"],
    outputs: ["contextPack"],
    configFields: [
      { key: "sources", label: "数据源", value: "纪要库、CRM、项目文档", kind: "textarea" },
      { key: "missingPolicy", label: "缺失处理", value: "生成待办并阻塞后续节点", kind: "select" },
      { key: "maxDocs", label: "最大文档数", value: "8", kind: "text" }
    ]
  },
  {
    id: "policy",
    kind: "decision",
    title: "规则与审批判断",
    description: "根据人数、会议类型和优先级选择执行路径。",
    position: { x: 890, y: 150 },
    owner: "规则引擎",
    inputs: ["meetingRequest", "contextPack"],
    outputs: ["routeDecision"],
    configFields: [
      { key: "condition", label: "审批条件", value: "attendeeCount > 5 || type === client", kind: "textarea" },
      { key: "approver", label: "审批人", value: "会议负责人", kind: "select" },
      { key: "timeout", label: "超时策略", value: "30 分钟后提醒", kind: "text" }
    ]
  },
  {
    id: "dispatch",
    kind: "action",
    title: "同步执行结果",
    description: "发送通知、创建行动项，并同步到下游系统。",
    position: { x: 1160, y: 150 },
    owner: "执行同步",
    inputs: ["agendaDraft", "contextPack", "routeDecision"],
    outputs: ["notifications", "actionItems"],
    configFields: [
      { key: "channels", label: "通知渠道", value: "Teams、邮件、任务系统", kind: "textarea" },
      { key: "retry", label: "失败重试", value: "开启", kind: "toggle" },
      { key: "minutesSync", label: "纪要同步", value: "会议结束后自动同步", kind: "text" }
    ]
  }
];

export const productWorkflowTemplates: ProductWorkflowTemplate[] = [
  {
    id: "template-weekly-sync",
    name: "周会同步工作流",
    description: "适合团队周会，自动生成议程、拉取上周行动项并同步本周待办。",
    category: "weekly",
    status: "published",
    updatedAt: "2026-06-01T03:20:00.000Z",
    nodes: commonMeetingNodes,
    edges: [
      { id: "intake-agenda", source: "intake", target: "agenda", label: "request", dataMapping: { meetingGoal: "prompt.goal" } },
      { id: "agenda-context", source: "agenda", target: "context", label: "agenda", dataMapping: { agendaDraft: "query.keywords" } },
      { id: "context-policy", source: "context", target: "policy", label: "context", condition: "contextPack.ready === true" },
      { id: "policy-dispatch", source: "policy", target: "dispatch", label: "approved", condition: "routeDecision.canRun === true" }
    ]
  },
  {
    id: "template-client-review",
    name: "客户复盘工作流",
    description: "面向客户沟通和复盘会议，重点处理客户上下文、审批分支和会后任务分发。",
    category: "client",
    status: "published",
    updatedAt: "2026-06-03T06:10:00.000Z",
    nodes: commonMeetingNodes.map((node) =>
      node.id === "policy"
        ? {
            ...node,
            title: "客户会议审批",
            description: "客户会议默认进入负责人审批，并检查敏感信息。",
            configFields: [
              { key: "condition", label: "审批条件", value: "type === client || priority === high", kind: "textarea" },
              { key: "approver", label: "审批人", value: "客户成功负责人", kind: "select" },
              { key: "redaction", label: "敏感信息处理", value: "自动脱敏", kind: "toggle" }
            ]
          }
        : node
    ),
    edges: [
      { id: "intake-agenda", source: "intake", target: "agenda", label: "request" },
      { id: "agenda-context", source: "agenda", target: "context", label: "customer data" },
      { id: "context-policy", source: "context", target: "policy", label: "needs review", condition: "type === client" },
      { id: "policy-dispatch", source: "policy", target: "dispatch", label: "approved" }
    ]
  },
  {
    id: "template-decision-meeting",
    name: "决策审批工作流",
    description: "用于需要明确结论和审批链路的决策会议，强调规则判断和回放审计。",
    category: "review",
    status: "draft",
    updatedAt: "2026-06-05T09:00:00.000Z",
    nodes: commonMeetingNodes.map((node) =>
      node.id === "agenda"
        ? {
            ...node,
            title: "整理决策材料",
            description: "把会议目标转成决策项、选项和风险摘要。",
            outputs: ["decisionBrief", "riskSummary"]
          }
        : node
    ),
    edges: [
      { id: "intake-agenda", source: "intake", target: "agenda", label: "decision request" },
      { id: "agenda-context", source: "agenda", target: "context", label: "brief" },
      { id: "context-policy", source: "context", target: "policy", label: "evidence" },
      { id: "policy-dispatch", source: "policy", target: "dispatch", label: "decision" }
    ]
  }
];

export function buildAiApplicationsFromTemplates(templates: ProductWorkflowTemplate[]): AiApplication[] {
  return templates.flatMap((sourceTemplate) => {
    const template = ensureProductWorkflowNodeExecutors(sourceTemplate);
    const capabilities = Array.from(new Set(template.nodes.map((node) => node.kind)));
    const workflowApplication: AiApplication = {
      id: `app-${template.id.replace(/^template-/, "")}`,
      name: template.name.replace("工作流", "应用"),
      description: template.description,
      mode: "workflow",
      status: template.status,
      source: "workflow",
      templateId: template.id,
      category: template.category,
      entrypoint: "meeting.intake",
      apiEndpoint: `/api/workflows/runs?templateId=${template.id}`,
      modelProvider: template.nodes.some((node) => node.kind === "ai") ? "anthropic" : "mock",
      inputSchema: defaultMeetingAppInputSchema,
      outputSchema: defaultMeetingAppOutputSchema,
      promptConfig: {
        systemPrompt: "你是会议流程应用编排器，负责按流程节点推进会议准备、决策和执行。",
        userPrompt: "请根据会议输入启动工作流：{{meeting.meetingGoal}}",
        model: "claude-sonnet-4",
        temperature: 0.2,
        maxTokens: 1024
      },
      versions: [],
      capabilities,
      publishedAt: template.status === "published" ? template.updatedAt : "",
      updatedAt: template.updatedAt
    };

    const nodeApplications = template.nodes
      .filter((node) => node.executor?.type === "aiApplication")
      .map((node): AiApplication => ({
        id: node.executor?.applicationId ?? buildNodeAgentApplicationId(template.id, node.id),
        name: `${node.title}智能体`,
        description: node.description,
        mode: "agent",
        status: template.status,
        source: "node",
        templateId: template.id,
        nodeId: node.id,
        nodeKind: node.kind,
        category: template.category,
        entrypoint: `meeting.node.${node.id}`,
        apiEndpoint: `/api/apps/${node.executor?.applicationId ?? buildNodeAgentApplicationId(template.id, node.id)}/debug`,
        modelProvider: "anthropic",
        inputSchema: buildNodeAgentInputSchema(node),
        outputSchema: buildNodeAgentOutputSchema(node),
        promptConfig: buildNodeAgentPromptConfig(node),
        versions: node.agentVersions ?? [],
        capabilities: [node.kind],
        publishedAt: template.status === "published" ? template.updatedAt : "",
        updatedAt: template.updatedAt
      }));

    return [workflowApplication, ...nodeApplications];
  });
}

export const miniDifyApplications: AiApplication[] = buildAiApplicationsFromTemplates(productWorkflowTemplates);

export const productWorkflowRuns: ProductWorkflowRun[] = [
  {
    id: "run-weekly-128",
    templateId: "template-weekly-sync",
    meetingId: "meeting-001",
    name: "产品周例会 / 本周同步",
    status: "running",
    durationSeconds: 18,
    startedAt: "2026-06-09T02:14:02.000Z",
    nodeRuns: [
      { nodeId: "intake", status: "success", outputPayload: { meetingRequest: "product-weekly" } },
      { nodeId: "agenda", status: "success", outputPayload: { agendaItems: 3, risks: 2 } },
      { nodeId: "context", status: "blocked", errorMessage: "缺少项目简报" },
      { nodeId: "policy", status: "pending" },
      { nodeId: "dispatch", status: "pending" }
    ],
    logs: [
      { id: "log-001", time: "10:14:02", level: "info", message: "收到 meeting.created 触发事件", nodeId: "intake" },
      { id: "log-002", time: "10:14:04", level: "success", message: "议程已生成 3 个部分", nodeId: "agenda" },
      { id: "log-003", time: "10:14:06", level: "warning", message: "上下文查询缺少项目简报", nodeId: "context" },
      { id: "log-004", time: "10:14:07", level: "info", message: "审批分支等待上下文补齐", nodeId: "policy" }
    ]
  },
  {
    id: "run-client-077",
    templateId: "template-client-review",
    meetingId: "meeting-002",
    name: "客户复盘沟通会 / 试点反馈",
    status: "blocked",
    durationSeconds: 31,
    startedAt: "2026-06-09T03:30:12.000Z",
    nodeRuns: [
      { nodeId: "intake", status: "success" },
      { nodeId: "agenda", status: "success" },
      { nodeId: "context", status: "success", outputPayload: { documents: 6 } },
      { nodeId: "policy", status: "blocked", errorMessage: "等待客户成功负责人审批" },
      { nodeId: "dispatch", status: "pending" }
    ],
    logs: [
      { id: "log-101", time: "11:30:12", level: "info", message: "客户会议进入专用模板", nodeId: "intake" },
      { id: "log-102", time: "11:30:15", level: "success", message: "已加载 6 条客户上下文", nodeId: "context" },
      { id: "log-103", time: "11:30:19", level: "warning", message: "客户会议需要负责人审批", nodeId: "policy" }
    ]
  },
  {
    id: "run-decision-031",
    templateId: "template-decision-meeting",
    meetingId: "meeting-003",
    name: "候选人终面 / 录用决策",
    status: "completed",
    durationSeconds: 22,
    startedAt: "2026-06-08T08:10:00.000Z",
    endedAt: "2026-06-08T08:10:22.000Z",
    nodeRuns: [
      { nodeId: "intake", status: "success" },
      { nodeId: "agenda", status: "success", outputPayload: { decisionBrief: "建议进入薪资沟通" } },
      { nodeId: "context", status: "success" },
      { nodeId: "policy", status: "success" },
      { nodeId: "dispatch", status: "success", outputPayload: { actionItems: 1 } }
    ],
    logs: [
      { id: "log-201", time: "16:10:00", level: "info", message: "终面流程开始运行", nodeId: "intake" },
      { id: "log-202", time: "16:10:09", level: "success", message: "决策材料已生成", nodeId: "agenda" },
      { id: "log-203", time: "16:10:22", level: "success", message: "流程已完成并同步行动项", nodeId: "dispatch" }
    ]
  }
];

export const seedMeetings: MeetingRecord[] = [
  {
    id: "meeting-001",
    title: "产品周例会",
    type: "weekly",
    tags: ["研发协同", "周会"],
    host: "陈晴",
    owner: "王立",
    description: "同步版本节奏、风险与跨团队依赖。",
    meetingGoal: "明确本周重点需求、风险和版本排期，确认跨团队协作事项。",
    channel: "teams",
    startAt: "2026-03-30T01:30:00.000Z",
    endAt: "2026-03-30T02:30:00.000Z",
    priority: "medium",
    status: "scheduled",
    location: "上海 3F 大会议室",
    meetingLink: "https://teams.microsoft.com/l/product-weekly",
    isRecurring: true,
    recurrence: "每周一 09:30",
    participants: [
      { id: "participant-001", name: "陈晴", role: "host", status: "accepted" },
      { id: "participant-002", name: "王立", role: "recorder", status: "accepted" },
      { id: "participant-003", name: "周舟", role: "attendee", status: "accepted" },
      { id: "participant-004", name: "林一", role: "attendee", status: "pending" }
    ],
    agendaItems: [
      { id: "agenda-001", title: "上周行动项回顾", completed: true },
      { id: "agenda-002", title: "新需求评估与优先级确认", completed: false },
      { id: "agenda-003", title: "版本风险同步", completed: false }
    ],
    notes: "会前请准备燃尽图和依赖阻塞清单。",
    minutes: "",
    actionItems: [
      {
        id: "action-001",
        content: "整理版本风险清单",
        owner: "王立",
        dueDate: "2026-03-31",
        status: "in_progress"
      }
    ],
    notifications: {
      inviteSent: true,
      reminderSent: false,
      changeNotified: false
    },
    attendeeCount: 4,
    durationMinutes: 60,
    createdAt: "2026-03-27T02:00:00.000Z",
    updatedAt: "2026-03-29T08:00:00.000Z",
    submittedAt: "2026-03-27T02:05:00.000Z",
    ownerUserId: "user-admin-001"
  },
  {
    id: "meeting-002",
    title: "客户复盘沟通会",
    type: "client",
    tags: ["客户", "复盘"],
    host: "李沐",
    owner: "周行",
    description: "复盘试点反馈，确认下一阶段上线范围与资源安排。",
    meetingGoal: "对齐客户反馈、上线范围和支持计划，形成会后推进事项。",
    channel: "zoom",
    startAt: "2026-03-29T06:00:00.000Z",
    endAt: "2026-03-29T06:45:00.000Z",
    priority: "high",
    status: "in_progress",
    location: "客户会议室 A",
    meetingLink: "https://zoom.us/j/meeting-client-retro",
    isRecurring: false,
    recurrence: "",
    participants: [
      { id: "participant-005", name: "李沐", role: "host", status: "accepted" },
      { id: "participant-006", name: "周行", role: "recorder", status: "accepted" },
      { id: "participant-007", name: "客户成功团队", role: "attendee", status: "accepted" }
    ],
    agendaItems: [
      { id: "agenda-004", title: "试点数据回顾", completed: true },
      { id: "agenda-005", title: "客户反馈梳理", completed: true },
      { id: "agenda-006", title: "上线资源确认", completed: false }
    ],
    notes: "请重点关注客户提出的权限审批流程。",
    minutes: "已确认客户希望缩短审批链路，并增加导出能力。",
    actionItems: [
      {
        id: "action-002",
        content: "输出二期范围说明",
        owner: "周行",
        dueDate: "2026-03-31",
        status: "todo"
      },
      {
        id: "action-003",
        content: "评估导出能力开发成本",
        owner: "李沐",
        dueDate: "2026-04-02",
        status: "in_progress"
      }
    ],
    notifications: {
      inviteSent: true,
      reminderSent: true,
      changeNotified: false
    },
    attendeeCount: 3,
    durationMinutes: 45,
    createdAt: "2026-03-26T09:20:00.000Z",
    updatedAt: "2026-03-29T06:10:00.000Z",
    submittedAt: "2026-03-26T09:25:00.000Z",
    ownerUserId: "user-admin-001"
  },
  {
    id: "meeting-003",
    title: "候选人终面",
    type: "interview",
    tags: ["招聘", "面试"],
    host: "赵禾",
    owner: "孙敏",
    description: "与候选人完成终面和岗位匹配讨论。",
    meetingGoal: "完成终面结论并确认后续录用流程是否推进。",
    channel: "meet",
    startAt: "2026-03-28T07:00:00.000Z",
    endAt: "2026-03-28T08:00:00.000Z",
    priority: "medium",
    status: "completed",
    location: "招聘面试间 2",
    meetingLink: "https://meet.google.com/final-interview",
    isRecurring: false,
    recurrence: "",
    participants: [
      { id: "participant-008", name: "赵禾", role: "host", status: "accepted" },
      { id: "participant-009", name: "孙敏", role: "recorder", status: "accepted" },
      { id: "participant-010", name: "张扬", role: "attendee", status: "accepted" }
    ],
    agendaItems: [
      { id: "agenda-007", title: "候选人经历追问", completed: true },
      { id: "agenda-008", title: "岗位匹配度讨论", completed: true },
      { id: "agenda-009", title: "面试结论确认", completed: true }
    ],
    notes: "终面结束后 24 小时内给出反馈。",
    minutes: "候选人技术面表现稳定，建议进入薪资沟通阶段。",
    actionItems: [
      {
        id: "action-004",
        content: "安排 HR 薪资沟通",
        owner: "孙敏",
        dueDate: "2026-03-30",
        status: "completed"
      }
    ],
    notifications: {
      inviteSent: true,
      reminderSent: true,
      changeNotified: false
    },
    attendeeCount: 3,
    durationMinutes: 60,
    createdAt: "2026-03-24T03:00:00.000Z",
    updatedAt: "2026-03-28T09:00:00.000Z",
    submittedAt: "2026-03-24T03:10:00.000Z",
    ownerUserId: "user-admin-001"
  }
];

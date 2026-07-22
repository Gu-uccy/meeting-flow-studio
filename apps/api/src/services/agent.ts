import type {
  MeetingAgentAction,
  MeetingAgentInsight,
  MeetingAgentRun,
  MeetingAgentTraceStep,
  MeetingMemory,
  MeetingRecord,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";
import {
  buildMeetingContext,
  callLLM,
  isLLMAvailable
} from "./llm.js";

type MeetingAgentInput = {
  meeting: MeetingRecord;
  memories: MeetingMemory[];
  runs: ProductWorkflowRun[];
  templates: ProductWorkflowTemplate[];
  plan?: MeetingAgentWorkflowPlan | null;
  modelApiKey?: string;
  userId?: string;
  selectedTemplate?: ProductWorkflowTemplate | null;
  executedRun?: ProductWorkflowRun | null;
};

export type MeetingAgentWorkflowPlan = {
  templateId: string;
  rationale: string;
  model: string;
  degraded: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addTrace(
  trace: MeetingAgentTraceStep[],
  tool: string,
  input: string,
  output: string
) {
  trace.push({
    id: createId("trace"),
    tool,
    input,
    output
  });
}

function selectTemplate(meeting: MeetingRecord, templates: ProductWorkflowTemplate[]) {
  return templates.find((template) => template.category === meeting.type) ?? templates[0] ?? null;
}

function selectLatestRun(meeting: MeetingRecord, runs: ProductWorkflowRun[]) {
  return runs
    .filter((run) => run.meetingId === meeting.id)
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())[0] ?? null;
}

function extractJsonObject(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildFallbackPlan(input: Pick<MeetingAgentInput, "meeting" | "templates">, rationale?: string): MeetingAgentWorkflowPlan {
  const template = selectTemplate(input.meeting, input.templates);

  return {
    templateId: template?.id ?? "",
    rationale: rationale ?? (template ? `按会议类型 ${input.meeting.type} 匹配「${template.name}」。` : "没有可用工作流模板。"),
    model: "local-rule-agent",
    degraded: true
  };
}

export async function planMeetingAgentWorkflow(input: Pick<MeetingAgentInput, "meeting" | "memories" | "runs" | "templates" | "modelApiKey" | "userId">): Promise<MeetingAgentWorkflowPlan> {
  if (!isLLMAvailable(input.modelApiKey)) {
    throw new Error("未配置 AI API Key，工作流 Agent 不可用。请在账号设置中填写 OpenAI 兼容密钥，或配置 AI_API_KEY / OPENAI_API_KEY");
  }

  const seedPlan = buildFallbackPlan(input);
  if (!seedPlan.templateId) {
    throw new Error("没有可用工作流模板");
  }

  const meetingContext = buildMeetingContext(input.meeting);
  const candidateTemplates = input.templates.map((template) => ({
    id: template.id,
    name: template.name,
    category: template.category,
    status: template.status,
    nodes: template.nodes.map((node) => `${node.kind}:${node.title}`).join(" -> ")
  }));
  const recentRuns = input.runs
    .filter((run) => run.meetingId === input.meeting.id)
    .slice(0, 3)
    .map((run) => `${run.name} / ${run.status} / ${run.durationSeconds}s`);
  const relevantMemories = input.memories
    .slice(0, 5)
    .map((memory) => `${memory.kind}: ${memory.content}`);

  const prompt = [
    "你是 Meeting Flow Studio 的工作流 Agent 规划器。",
    "你需要为当前会议选择最合适的工作流模板。只能从候选模板中选择一个 templateId。",
    "请只输出 JSON，不要输出 Markdown。",
    'JSON 格式：{"templateId":"...","rationale":"不超过 60 字的中文理由"}',
    "",
    `会议标题：${meetingContext.title}`,
    `会议目标：${meetingContext.goal}`,
    `会议类型：${input.meeting.type}`,
    `优先级：${input.meeting.priority}`,
    `参会人：${meetingContext.attendees.join("、")}`,
    `议程：${meetingContext.agendaItems.join("、")}`,
    "",
    `候选模板：${JSON.stringify(candidateTemplates)}`,
    `近期运行：${recentRuns.join("；") || "无"}`,
    `相关记忆：${relevantMemories.join("；") || "无"}`
  ].join("\n");

  try {
    const result = await callLLM({
      model: "gpt-4o-mini",
      prompt,
      temperature: 0.1,
      maxTokens: 220,
      apiKey: input.modelApiKey,
      userId: input.userId
    });
    const parsed = extractJsonObject(result.content);
    const templateId = typeof parsed?.["templateId"] === "string" ? parsed["templateId"] : "";
    const rationale = typeof parsed?.["rationale"] === "string" ? parsed["rationale"] : "";

    if (!input.templates.some((template) => template.id === templateId)) {
      throw new Error(`AI 返回的模板不可用：${templateId || "(空)"}`);
    }

    return {
      templateId,
      rationale: rationale || "AI 已根据会议上下文选择匹配模板。",
      model: result.model,
      degraded: false
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("未配置 AI API Key")) {
      throw error;
    }
    throw new Error(error instanceof Error ? `Agent 模板规划失败：${error.message}` : "Agent 模板规划失败");
  }
}

function pushAction(actions: MeetingAgentAction[], action: Omit<MeetingAgentAction, "id">) {
  actions.push({
    id: createId("agent-action"),
    ...action
  });
}

function pushInsight(insights: MeetingAgentInsight[], insight: Omit<MeetingAgentInsight, "id">) {
  insights.push({
    id: createId("agent-insight"),
    ...insight
  });
}

function buildDeterministicActions(input: MeetingAgentInput, trace: MeetingAgentTraceStep[]) {
  const { meeting, memories, runs, templates } = input;
  const actions: MeetingAgentAction[] = [];
  const insights: MeetingAgentInsight[] = [];
  const latestRun = input.executedRun ?? selectLatestRun(meeting, runs);
  const template = input.selectedTemplate ?? selectTemplate(meeting, templates);
  const blockedNode = latestRun?.nodeRuns.find((nodeRun) => nodeRun.status === "blocked");
  const pendingAgendaItems = meeting.agendaItems.filter((item) => !item.completed);
  const openActionItems = meeting.actionItems.filter((item) => item.status !== "completed");
  const hasCalendarSync = Boolean(meeting.externalCalendar);

  addTrace(
    trace,
    "inspect_meeting",
    meeting.id,
    `${meeting.title} / ${meeting.status} / ${meeting.priority} / ${meeting.attendeeCount} attendees`
  );

  if (input.executedRun && template) {
    addTrace(
      trace,
      "ai_plan_workflow",
      input.plan?.model ?? "local-rule-agent",
      input.plan?.rationale ?? `选择模板 ${template.name}`
    );

    addTrace(
      trace,
      "execute_workflow",
      template.id,
      `${input.executedRun.id} / ${input.executedRun.status} / ${input.executedRun.durationSeconds}s`
    );

    pushInsight(insights, {
      kind: "automation",
      title: "Agent 已执行工作流",
      description: `已运行「${template.name}」，当前结果为 ${input.executedRun.status}。`,
      evidence: input.executedRun.logs.slice(-3).map((log) => log.message)
    });
  }

  if (!latestRun && template) {
    pushAction(actions, {
      kind: "start_workflow",
      title: "启动匹配的会议流程",
      description: `建议使用「${template.name}」处理这场会议，生成议程、上下文检查和后续执行记录。`,
      priority: meeting.priority === "critical" || meeting.priority === "high" ? "high" : "medium",
      confidence: 0.88,
      targetId: template.id,
      payload: { templateId: template.id }
    });
  }

  if (blockedNode && latestRun) {
    pushAction(actions, {
      kind: "advance_blocker",
      title: "处理阻塞节点",
      description: blockedNode.errorMessage
        ? `当前流程阻塞在 ${blockedNode.nodeId}：${blockedNode.errorMessage}`
        : `当前流程阻塞在 ${blockedNode.nodeId}，需要补充处理说明后继续。`,
      priority: "critical",
      confidence: 0.94,
      targetId: latestRun.id,
      payload: {
        runId: latestRun.id,
        nodeId: blockedNode.nodeId
      }
    });
  }

  if (!hasCalendarSync && meeting.status !== "draft" && meeting.status !== "cancelled") {
    pushAction(actions, {
      kind: "sync_calendar",
      title: "同步外部日历",
      description: "会议已进入排期或执行阶段，但还没有外部日历事件，建议同步到 Google Calendar 或飞书日历。",
      priority: meeting.priority === "high" || meeting.priority === "critical" ? "high" : "medium",
      confidence: 0.82,
      targetId: meeting.id,
      payload: { meetingId: meeting.id }
    });
  }

  if (pendingAgendaItems.length === 0 || !meeting.notes.trim()) {
    pushAction(actions, {
      kind: "prepare_agenda",
      title: "补齐会前材料",
      description: pendingAgendaItems.length === 0
        ? "当前没有待讨论议程，建议补充议程和会前背景。"
        : "当前会前说明较少，建议补充背景材料，降低上下文检索节点阻塞概率。",
      priority: "medium",
      confidence: 0.76,
      targetId: meeting.id,
      payload: { meetingId: meeting.id }
    });
  }

  const riskMemories = memories.filter((memory) => memory.kind === "risk");
  if (riskMemories.length > 0) {
    pushAction(actions, {
      kind: "review_memory",
      title: "复查历史风险",
      description: `找到 ${riskMemories.length} 条相关风险记忆，建议在会前确认是否仍然存在。`,
      priority: "high",
      confidence: 0.84,
      targetId: riskMemories[0]?.id ?? "",
      payload: { memoryId: riskMemories[0]?.id ?? "" }
    });
  }

  if (openActionItems.length > 0) {
    pushInsight(insights, {
      kind: "context",
      title: "仍有未完成行动项",
      description: `当前会议关联 ${openActionItems.length} 个未完成行动项，适合在流程执行前先确认负责人和截止时间。`,
      evidence: openActionItems.slice(0, 3).map((item) => `${item.owner}: ${item.content}`)
    });
  }

  if (blockedNode) {
    pushInsight(insights, {
      kind: "risk",
      title: "流程存在人工阻塞",
      description: blockedNode.errorMessage ?? "最新运行存在阻塞节点，需要人工补充信息。",
      evidence: latestRun ? latestRun.logs.slice(-3).map((log) => log.message) : []
    });
  }

  if (meeting.type === "client" || meeting.priority === "high" || meeting.priority === "critical") {
    pushInsight(insights, {
      kind: "automation",
      title: "建议保留审批链路",
      description: "客户会议或高优先级会议更适合走审批/规则节点，避免上下文缺失后直接分发结果。",
      evidence: [`type=${meeting.type}`, `priority=${meeting.priority}`]
    });
  }

  if (actions.length === 0) {
    pushAction(actions, {
      kind: "none",
      title: "保持当前推进节奏",
      description: "没有发现必须立即处理的阻塞或缺口，可以继续观察流程运行结果。",
      priority: "low",
      confidence: 0.68,
      targetId: meeting.id,
      payload: {}
    });
  }

  addTrace(
    trace,
    "rank_actions",
    `${actions.length} actions`,
    actions.map((action) => `${action.priority}:${action.kind}`).join(", ")
  );

  return {
    actions: actions.sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority)),
    insights
  };
}

function priorityWeight(priority: MeetingAgentAction["priority"]) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function buildFallbackSummary(input: MeetingAgentInput, actions: MeetingAgentAction[], insights: MeetingAgentInsight[]) {
  const topAction = actions[0];
  const meetingContext = buildMeetingContext(input.meeting);
  const insightText = insights.length > 0 ? `识别到 ${insights.length} 条上下文洞察。` : "未发现明显风险。";

  if (input.executedRun) {
    const templateName = input.selectedTemplate?.name ?? "匹配工作流";
    const statusText = input.executedRun.status === "blocked"
      ? "流程已运行，但需要人工处理阻塞节点。"
      : input.executedRun.status === "completed"
        ? "流程已由 Agent 执行完成。"
        : `流程执行结果为 ${input.executedRun.status}。`;

    return [
      `Agent 已运行「${templateName}」。`,
      input.plan?.degraded === false ? "AI 已参与模板规划。" : "",
      statusText,
      topAction && topAction.kind !== "none" ? `下一步：${topAction.title}。` : insightText
    ].filter(Boolean).join(" ");
  }

  return [
    `Agent 已分析「${meetingContext.title}」。`,
    topAction ? `优先建议：${topAction.title}。` : "暂无必须处理的动作。",
    insightText
  ].join(" ");
}

async function buildLlmSummary(input: MeetingAgentInput, actions: MeetingAgentAction[], insights: MeetingAgentInsight[]) {
  if (!isLLMAvailable(input.modelApiKey)) {
    throw new Error("未配置 AI API Key，工作流 Agent 不可用。请在账号设置中填写 OpenAI 兼容密钥，或配置 AI_API_KEY / OPENAI_API_KEY");
  }

  const meetingContext = buildMeetingContext(input.meeting);
  const prompt = [
    "你是 Meeting Flow Studio 的内置会议流程 Agent。",
    "你刚刚负责运行会议工作流。请基于会议上下文、执行结果、候选动作和洞察，输出一段 80 字以内的中文行动摘要。",
    "",
    `会议：${meetingContext.title}`,
    `目标：${meetingContext.goal}`,
    `参会人：${meetingContext.attendees.join("、")}`,
    `议程：${meetingContext.agendaItems.join("、")}`,
    `AI 规划：${input.plan?.rationale ?? "无"}`,
    `执行结果：${input.executedRun ? `${input.executedRun.status} / ${input.executedRun.durationSeconds}s / ${input.executedRun.id}` : "尚未执行"}`,
    "",
    "候选动作：",
    ...actions.map((action) => `- ${action.priority} / ${action.title}: ${action.description}`),
    "",
    "洞察：",
    ...insights.map((insight) => `- ${insight.kind} / ${insight.title}: ${insight.description}`)
  ].join("\n");

  const result = await callLLM({
    model: "gpt-4o-mini",
    prompt,
    temperature: 0.2,
    maxTokens: 260,
    apiKey: input.modelApiKey,
    userId: input.userId
  });

  return {
    model: result.model,
    summary: result.content.trim() || buildFallbackSummary(input, actions, insights),
    degraded: false
  };
}

export async function runMeetingAgent(input: MeetingAgentInput): Promise<MeetingAgentRun> {
  const trace: MeetingAgentTraceStep[] = [];
  const { actions, insights } = buildDeterministicActions(input, trace);
  const llm = await buildLlmSummary(input, actions, insights);

  addTrace(
    trace,
    "compose_brief",
    llm.model,
    llm.summary
  );

  return {
    id: createId("agent-run"),
    meetingId: input.meeting.id,
    templateId: input.selectedTemplate?.id ?? "",
    workflowRunId: input.executedRun?.id ?? "",
    executionStatus: input.executedRun?.status ?? "not_started",
    createdAt: nowIso(),
    status: llm.degraded ? "degraded" : "completed",
    summary: llm.summary,
    model: llm.model,
    actions,
    insights,
    trace
  };
}

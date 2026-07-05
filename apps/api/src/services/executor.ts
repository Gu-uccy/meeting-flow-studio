import type {
  AiApplicationOutputField,
  MeetingRecord,
  ProductNodeRun,
  ProductRunLog,
  ProductWorkflowNode,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";
import {
  buildAINodePrompt,
  buildMeetingContext,
  buildNodeAgentPrompt,
  callLLM,
  extractConfigValues,
  isLLMAvailable
} from "./llm.js";

// ── SIMPLE CONDITION EVALUATOR ──

function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  if (!condition.trim()) {
    return true;
  }

  try {
    // Replace property access with context lookup
    const tokens = tokenize(condition);
    const evaluated = parseExpression(tokens, context);
    return Boolean(evaluated);
  } catch {
    // If evaluation fails, default to true (pass through)
    return true;
  }
}

type Token =
  | { type: "ident"; value: string }
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "paren"; value: string }
  | { type: "dot"; value: string }
  | { type: "questionDot"; value: string }
  | { type: "bool"; value: boolean };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "(" || ch === ")") { tokens.push({ type: "paren", value: ch }); i++; continue; }
    if (ch === "?") {
      if (expr[i + 1] === ".") { tokens.push({ type: "questionDot", value: "?." }); i += 2; continue; }
      tokens.push({ type: "op", value: "?" }); i++; continue;
    }
    if (ch === ".") { tokens.push({ type: "dot", value: "." }); i++; continue; }

    if ((ch === "=" && expr[i + 1] === "=" && expr[i + 2] === "=") || (ch === "!" && expr[i + 1] === "=" && expr[i + 2] === "=")) {
      tokens.push({ type: "op", value: expr.slice(i, i + 3) }); i += 3; continue;
    }
    if ((ch === "=" && expr[i + 1] === "=") || (ch === "!" && expr[i + 1] === "=") || (ch === ">" && expr[i + 1] === "=") || (ch === "<" && expr[i + 1] === "=") || (ch === "&" && expr[i + 1] === "&") || (ch === "|" && expr[i + 1] === "|")) {
      tokens.push({ type: "op", value: expr.slice(i, i + 2) }); i += 2; continue;
    }
    if (ch === ">" || ch === "<" || ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch }); i++; continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      let j = i + 1;
      let str = "";
      while (j < expr.length && expr[j] !== quote) {
        if (expr[j] === "\\") { j++; }
        str += expr[j] ?? "";
        j++;
      }
      tokens.push({ type: "string", value: str });
      i = j + 1;
      continue;
    }

    if (/\d/.test(ch) || (ch === "." && i + 1 < expr.length && /\d/.test(expr[i + 1] ?? ""))) {
      let j = i;
      while (j < expr.length && /[\d.]/.test(expr[j] ?? "")) { j++; }
      tokens.push({ type: "number", value: Number(expr.slice(i, j)) });
      i = j;
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[a-zA-Z0-9_$]/.test(expr[j] ?? "")) { j++; }
      const word = expr.slice(i, j);
      if (word === "true") { tokens.push({ type: "bool", value: true }); }
      else if (word === "false") { tokens.push({ type: "bool", value: false }); }
      else { tokens.push({ type: "ident", value: word }); }
      i = j;
      continue;
    }

    i++;
  }

  return tokens;
}

function resolveIdentifier(parts: string[], context: Record<string, unknown>): unknown {
  let value: unknown = context;
  for (const part of parts) {
    if (value == null) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function parseExpression(tokens: Token[], context: Record<string, unknown>, pos: { i: number } = { i: 0 }): unknown {
  return parseOr(tokens, context, pos);
}

function parseOr(tokens: Token[], context: Record<string, unknown>, pos: { i: number }): unknown {
  let left = parseAnd(tokens, context, pos);
  while (pos.i < tokens.length && tokens[pos.i]?.type === "op" && tokens[pos.i]?.value === "||") {
    pos.i++;
    const right = parseAnd(tokens, context, pos);
    left = Boolean(left) || Boolean(right);
  }
  return left;
}

function parseAnd(tokens: Token[], context: Record<string, unknown>, pos: { i: number }): unknown {
  let left = parseCompare(tokens, context, pos);
  while (pos.i < tokens.length && tokens[pos.i]?.type === "op" && tokens[pos.i]?.value === "&&") {
    pos.i++;
    const right = parseCompare(tokens, context, pos);
    left = Boolean(left) && Boolean(right);
  }
  return left;
}

function parseCompare(tokens: Token[], context: Record<string, unknown>, pos: { i: number }): unknown {
  let left = parsePrimary(tokens, context, pos);
  if (pos.i < tokens.length && tokens[pos.i]?.type === "op" && ["===", "==", "!==", "!=", ">", "<", ">=", "<="].includes(String(tokens[pos.i]?.value ?? ""))) {
    const op = String(tokens[pos.i]?.value ?? "==");
    pos.i++;
    const right = parsePrimary(tokens, context, pos);
    switch (op) {
      case "===": case "==": return left === right;
      case "!==": case "!=": return left !== right;
      case ">": return Number(left) > Number(right);
      case "<": return Number(left) < Number(right);
      case ">=": return Number(left) >= Number(right);
      case "<=": return Number(left) <= Number(right);
      default: return false;
    }
  }
  return left;
}

function parsePrimary(tokens: Token[], context: Record<string, unknown>, pos: { i: number }): unknown {
  const token = tokens[pos.i];
  if (!token) return undefined;

  if (token.type === "number") { pos.i++; return token.value; }
  if (token.type === "string") { pos.i++; return token.value; }
  if (token.type === "bool") { pos.i++; return token.value; }

  if (token.type === "paren" && token.value === "(") {
    pos.i++;
    const val = parseExpression(tokens, context, pos);
    if (tokens[pos.i]?.type === "paren" && tokens[pos.i]?.value === ")") pos.i++;
    return val;
  }

  if (token.type === "op" && token.value === "!") {
    pos.i++;
    return !parsePrimary(tokens, context, pos);
  }

  if (token.type === "ident") {
    const parts: string[] = [token.value];
    pos.i++;
    while (pos.i < tokens.length && (tokens[pos.i]?.type === "dot" || tokens[pos.i]?.type === "questionDot")) {
      pos.i++; // skip dot
      if (pos.i < tokens.length && tokens[pos.i]?.type === "ident") {
        parts.push(String(tokens[pos.i]!.value));
        pos.i++;
      }
    }
    return resolveIdentifier(parts, context);
  }

  pos.i++;
  return undefined;
}

// ── DAG EXECUTION PLAN ──

type ExecutionNode = {
  node: ProductWorkflowNode;
  wave: number;
  deps: string[];
};

type RuntimePayload = Record<string, unknown>;

function normalizeRuntimeValue(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return value;
}

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, source);
}

function buildMeetingPayload(meeting: MeetingRecord): Record<string, unknown> {
  return {
    attendeeCount: meeting.attendeeCount,
    meetingGoal: meeting.meetingGoal,
    meetingId: meeting.id,
    participants: meeting.participants.map((participant) => participant.name),
    priority: meeting.priority,
    title: meeting.title,
    type: meeting.type
  };
}

function buildWorkflowRuntimeContext(meeting: MeetingRecord, nodeResults: Map<string, ProductNodeRun>): Record<string, unknown> {
  return {
    meeting: buildMeetingPayload(meeting),
    node: Object.fromEntries([...nodeResults.entries()].map(([nodeId, run]) => [nodeId, run.outputPayload ?? {}]))
  };
}

function buildNodeInputPayload(
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputs?: Record<string, unknown>
): RuntimePayload {
  const runtimeContext = inputs?.meeting || inputs?.node ? inputs : { meeting: buildMeetingPayload(meeting) };
  const mappedInputs = Object.fromEntries(
    Object.entries(node.executor?.inputMapping ?? {}).map(([key, path]) => {
      return [key, inputs?.[key] ?? getPathValue(runtimeContext, path) ?? path];
    })
  );

  return Object.fromEntries(
    Object.entries({
      ...mappedInputs,
      ...inputs
    }).map(([key, value]) => [key, normalizeRuntimeValue(value)])
  );
}

function getNodeOutputSchema(node: ProductWorkflowNode): AiApplicationOutputField[] {
  if (node.agentOutputSchema?.length) {
    return node.agentOutputSchema;
  }

  if (node.executor?.type === "aiApplication") {
    return node.outputs.map((output) => ({
      key: output,
      label: output,
      type: inferNodeOutputType(output),
      description: ""
    }));
  }

  return [];
}

function inferNodeOutputType(output: string): AiApplicationOutputField["type"] {
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

function extractJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function coerceOutputValue(field: AiApplicationOutputField, value: unknown): { value: unknown; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { value, error: `${field.label || field.key} 缺少输出` };
  }

  if (field.type === "text") {
    return { value: typeof value === "string" ? value : JSON.stringify(value) };
  }

  if (field.type === "number") {
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue)
      ? { value: numericValue }
      : { value, error: `${field.label || field.key} 必须是数字` };
  }

  if (field.type === "boolean") {
    if (typeof value === "boolean") {
      return { value };
    }

    if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) {
      return { value: value.toLowerCase() === "true" };
    }

    return { value, error: `${field.label || field.key} 必须是布尔值` };
  }

  if (field.type === "json" && typeof value === "string") {
    try {
      return { value: JSON.parse(value) };
    } catch {
      return { value, error: `${field.label || field.key} 必须是 JSON` };
    }
  }

  return { value };
}

function validateStructuredOutput(schema: AiApplicationOutputField[], rawOutput: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of schema) {
    const coerced = coerceOutputValue(field, rawOutput[field.key]);
    if (coerced.error) {
      errors.push(coerced.error);
    } else {
      output[field.key] = coerced.value;
    }
  }

  return { output, errors };
}

function buildMockStructuredOutput(schema: AiApplicationOutputField[], node: ProductWorkflowNode, meeting: MeetingRecord) {
  return Object.fromEntries(
    schema.map((field) => {
      if (field.type === "number") {
        return [field.key, field.key.toLowerCase().includes("risk") ? (meeting.priority === "high" || meeting.priority === "critical" ? 2 : 1) : meeting.agendaItems.length];
      }

      if (field.type === "boolean") {
        return [field.key, true];
      }

      if (field.type === "text") {
        return [field.key, `${node.title} 模拟输出`];
      }

      return [field.key, { source: "mock", nodeId: node.id, meetingId: meeting.id, ready: true }];
    })
  );
}

function applyNodeOutputSchema(node: ProductWorkflowNode, meeting: MeetingRecord, outputPayload: RuntimePayload): RuntimePayload {
  const schema = getNodeOutputSchema(node);
  if (schema.length === 0) {
    return outputPayload;
  }

  const rawStructuredOutput =
    typeof outputPayload.llmContent === "string"
      ? extractJsonObject(outputPayload.llmContent)
      : null;
  const rawOutput =
    rawStructuredOutput ??
    (outputPayload.outputSchemaSource === "mock" || typeof outputPayload.llmContent !== "string"
      ? { ...buildMockStructuredOutput(schema, node, meeting), ...outputPayload }
      : {});
  const { output, errors } = validateStructuredOutput(schema, rawOutput);

  if (errors.length > 0) {
    throw new Error(`输出 Schema 校验失败：${errors.join("；")}`);
  }

  return {
    ...outputPayload,
    ...output,
    outputSchemaValid: true,
    outputSchemaFields: schema.map((field) => field.key),
    structuredOutput: output
  };
}

function configValue(node: ProductWorkflowNode, key: string) {
  return node.configFields.find((field) => field.key === key)?.value.trim() ?? "";
}

async function executeHttpToolNode(
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputPayload: RuntimePayload
): Promise<RuntimePayload> {
  const url = configValue(node, "toolUrl");
  const method = (configValue(node, "toolMethod") || "POST").toUpperCase();
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: method === "GET" ? undefined : JSON.stringify({
      meetingId: meeting.id,
      nodeId: node.id,
      inputs: inputPayload
    })
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(`工具调用失败：${response.status} ${response.statusText}`);
  }

  return {
    toolUrl: url,
    toolMethod: method,
    toolStatus: response.status,
    toolResult: body
  };
}

function buildExecutionPlan(template: ProductWorkflowTemplate): { plan: ExecutionNode[]; hasCycle: boolean } {
  const nodeById = new Map(template.nodes.map((n) => [n.id, n]));
  const incomingCount = new Map(template.nodes.map((n): [string, number] => [n.id, 0]));
  const outgoing = new Map(template.nodes.map((n) => [n.id, [] as string[]]));

  for (const edge of template.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  // Kahn's algorithm with wave assignment
  const waveMap = new Map<string, number>();
  const queue = template.nodes
    .filter((n) => (incomingCount.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  for (const id of queue) waveMap.set(id, 0);

  let head = 0;
  while (head < queue.length) {
    const currentId = queue[head++]!;
    const currentWave = waveMap.get(currentId) ?? 0;

    for (const targetId of (outgoing.get(currentId) ?? [])) {
      const nextCount = Math.max(0, (incomingCount.get(targetId) ?? 0) - 1);
      incomingCount.set(targetId, nextCount);

      const existingWave = waveMap.get(targetId) ?? -1;
      waveMap.set(targetId, Math.max(existingWave, currentWave + 1));

      if (nextCount === 0) {
        queue.push(targetId);
      }
    }
  }

  const hasCycle = template.nodes.some((n) => !queue.includes(n.id));

  const plan = template.nodes
    .filter((n) => queue.includes(n.id))
    .map((n) => ({
      node: n,
      wave: waveMap.get(n.id) ?? 0,
      deps: template.edges.filter((e) => e.target === n.id).map((e) => e.source)
    }));

  // Append cycle nodes
  for (const node of template.nodes.filter((n) => !queue.includes(n.id))) {
    plan.push({ node, wave: Number.MAX_SAFE_INTEGER, deps: [] });
  }

  return { plan, hasCycle };
}

// ── NODE EXECUTORS ──

async function executeNodeByKind(
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputs?: Record<string, unknown>
): Promise<ProductNodeRun> {
  const startedAt = new Date();

  try {
    let outputPayload: RuntimePayload | undefined;
    const inputPayload = buildNodeInputPayload(node, meeting, inputs);

    switch (node.kind) {
      case "trigger":
        outputPayload = {
          meetingRequest: meeting.id,
          meetingType: meeting.type,
          attendeeCount: meeting.attendeeCount
        };
        break;

      case "ai": {
        const config = extractConfigValues(node);
        const meetingCtx = buildMeetingContext(meeting);
        const renderedAgentPrompt = node.agentPromptConfig
          ? buildNodeAgentPrompt(node.agentPromptConfig, node, meeting, inputPayload)
          : null;
        const prompt = renderedAgentPrompt?.userPrompt ?? buildAINodePrompt(config, meetingCtx);
        const model = node.agentPromptConfig?.model ?? config["model"] ?? "claude-sonnet-4";
        const temperature = node.agentPromptConfig?.temperature ?? config["temperature"] ?? 0.5;

        if (isLLMAvailable()) {
          const result = await callLLM({
            model,
            prompt,
            systemPrompt: renderedAgentPrompt?.systemPrompt,
            temperature,
            maxTokens: node.agentPromptConfig?.maxTokens
          });
          outputPayload = {
            llmContent: result.content,
            llmModel: result.model,
            llmPrompt: prompt,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens
          };
        } else {
          // Fallback: simulated output
          outputPayload = {
            agendaItems: meeting.agendaItems.length,
            risks: meeting.priority === "high" || meeting.priority === "critical" ? 2 : 1,
            note: "LLM 未接入（ANTHROPIC_API_KEY 未配置），使用模拟输出",
            outputSchemaSource: "mock",
            ...buildMockStructuredOutput(getNodeOutputSchema(node), node, meeting)
          };
        }
        break;
      }

      case "knowledge":
        outputPayload = {
          documents: Math.max(1, meeting.participants.length + meeting.actionItems.length),
          notesReady: Boolean(meeting.notes.trim())
        };
        break;

      case "decision":
        outputPayload = {
          routeDecision:
            meeting.type === "client" || meeting.attendeeCount > 5
              ? "needs_review"
              : "auto_approved"
        };
        break;

      case "action":
        if (configValue(node, "toolUrl")) {
          outputPayload = await executeHttpToolNode(node, meeting, inputPayload);
        } else {
          outputPayload = {
            notifications: Object.values(meeting.notifications).filter(Boolean).length,
            actionItems: meeting.actionItems.length
          };
        }
        break;

      default:
        outputPayload = { output: "completed" };
    }

    return {
      nodeId: node.id,
      status: "success",
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      inputPayload,
      outputPayload: outputPayload ? applyNodeOutputSchema(node, meeting, outputPayload) : outputPayload
    };
  } catch (error) {
    return {
      nodeId: node.id,
      status: "failed",
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : "节点执行失败"
    };
  }
}

async function executeNodeByExecutor(
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputs?: Record<string, unknown>
): Promise<ProductNodeRun> {
  const executor = node.executor;
  const startedAt = new Date();
  const currentVersion = node.agentVersions?.find((version) => version.status === "published") ?? node.agentVersions?.[0];

  if (executor?.type === "manual") {
    return {
      nodeId: node.id,
      status: "blocked",
      startedAt: startedAt.toISOString(),
      inputPayload: buildNodeInputPayload(node, meeting, inputs),
      errorMessage: `${node.title} 等待人工处理`
    };
  }

  const result = await executeNodeByKind(node, meeting, inputs);

  if (result.status !== "success") {
    return result;
  }

  return {
    ...result,
    outputPayload: {
      ...(result.outputPayload ?? {}),
      executorApplicationId: executor?.applicationId ?? "",
      executorRuntime: executor?.runtime ?? node.kind,
      executorType: executor?.type ?? "system",
      agentVersionId: currentVersion?.id ?? "",
      agentVersion: currentVersion?.version ?? "",
      agentVersionStatus: currentVersion?.status ?? ""
    }
  };
}

function getBlockingReason(node: ProductWorkflowNode, meeting: MeetingRecord): string {
  if (node.id === "context" && !meeting.notes.trim()) {
    return "缺少会前材料或背景说明";
  }
  if (node.id === "policy" && meeting.type === "client" && meeting.priority === "high") {
    return "客户高优先级会议需要负责人审批";
  }
  return "";
}

async function executeNode(
  nodeInfo: ExecutionNode,
  meeting: MeetingRecord,
  retryConfig: { maxRetries: number; retryDelayMs: number },
  inputs?: Record<string, unknown>
): Promise<ProductNodeRun> {
  const { node } = nodeInfo;

  // Check blocking conditions
  const blockingReason = getBlockingReason(node, meeting);
  if (blockingReason) {
    return {
      nodeId: node.id,
      status: "blocked",
      errorMessage: blockingReason
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryConfig.retryDelayMs));
    }

    const result = await executeNodeByExecutor(node, meeting, inputs);
    if (result.status === "success") {
      return result;
    }

    lastError = new Error(result.errorMessage ?? "节点执行失败");
  }

  return {
    nodeId: node.id,
    status: "failed",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    errorMessage: lastError?.message ?? "节点在重试后仍然失败"
  };
}

// ── MAIN EXECUTOR ──

export async function executeWorkflowRun(
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  retryConfig?: { maxRetries?: number; retryDelayMs?: number }
): Promise<ProductWorkflowRun> {
  const startedAt = new Date();
  const logs: ProductRunLog[] = [];
  const nodeResults = new Map<string, ProductNodeRun>();
  const maxRetries = retryConfig?.maxRetries ?? 2;
  const retryDelayMs = retryConfig?.retryDelayMs ?? 1000;

  const { plan, hasCycle } = buildExecutionPlan(template);

  logs.push({
    id: `log-${Date.now()}-start`,
    time: logTime(startedAt),
    level: "info",
    message: `流程 "${template.name}" 已启动`
  });

  if (hasCycle) {
    logs.push({
      id: `log-${Date.now()}-cycle`,
      time: logTime(new Date()),
      level: "warning",
      message: "检测到画布存在循环，循环节点将按顺序补充执行"
    });
  }

  // Execute by waves
  const maxWave = Math.max(...plan.map((n) => n.wave), 0);

  for (let wave = 0; wave <= maxWave; wave++) {
    const waveNodes = plan.filter((n) => n.wave === wave);

    if (waveNodes.length === 0) continue;

    const runtimeContext = buildWorkflowRuntimeContext(meeting, nodeResults);
    const wavePromises = waveNodes.map(async (nodeInfo) => {
      // Check edge conditions for incoming edges
      const incomingEdges = template.edges.filter((e) => e.target === nodeInfo.node.id);
      const routeLabel = incomingEdges
        .map((e) => e.condition || e.label)
        .filter(Boolean)
        .join(" / ");

      if (routeLabel) {
        logs.push({
          id: `log-${Date.now()}-${nodeInfo.node.id}-route`,
          time: logTime(new Date()),
          level: "info",
          message: `经由连线进入：${routeLabel}`,
          nodeId: nodeInfo.node.id
        });
      }

      // Evaluate whether this node should be skipped based on edge conditions
      const hasActiveIncomingEdge = incomingEdges.some((edge) => {
        if (!edge.condition) return true;
        const sourceResult = nodeResults.get(edge.source);
        const evalContext = { ...(sourceResult?.outputPayload ?? {}) };
        return evaluateCondition(edge.condition, evalContext);
      });

      if (!hasActiveIncomingEdge && incomingEdges.length > 0) {
        const skippedRun: ProductNodeRun = {
          nodeId: nodeInfo.node.id,
          status: "skipped",
          startedAt: new Date().toISOString()
        };
        logs.push({
          id: `log-${Date.now()}-${nodeInfo.node.id}-skipped`,
          time: logTime(new Date()),
          level: "warning",
          message: `${nodeInfo.node.title} 被条件跳过`,
          nodeId: nodeInfo.node.id
        });
        return { nodeId: nodeInfo.node.id, result: skippedRun };
      }

      const result = await executeNode(nodeInfo, meeting, { maxRetries, retryDelayMs }, runtimeContext);

      if (result.status === "success") {
        logs.push({
          id: `log-${Date.now()}-${nodeInfo.node.id}-done`,
          time: logTime(new Date()),
          level: "success",
          message: `${nodeInfo.node.title} 已完成`,
          nodeId: nodeInfo.node.id
        });
      } else if (result.status === "blocked") {
        logs.push({
          id: `log-${Date.now()}-${nodeInfo.node.id}-blocked`,
          time: logTime(new Date()),
          level: "warning",
          message: result.errorMessage ?? `${nodeInfo.node.title} 需要人工处理`,
          nodeId: nodeInfo.node.id
        });
      } else {
        logs.push({
          id: `log-${Date.now()}-${nodeInfo.node.id}-failed`,
          time: logTime(new Date()),
          level: "error",
          message: result.errorMessage ?? `${nodeInfo.node.title} 执行失败`,
          nodeId: nodeInfo.node.id
        });
      }

      return { nodeId: nodeInfo.node.id, result };
    });

    const waveResults = await Promise.all(wavePromises);
    for (const { nodeId, result } of waveResults) {
      nodeResults.set(nodeId, result);
    }
  }

  // Determine overall status
  const allRuns = [...nodeResults.values()];
  const hasFailed = allRuns.some((r) => r.status === "failed");
  const hasBlocked = allRuns.some((r) => r.status === "blocked");
  const status = hasFailed ? "failed" : hasBlocked ? "blocked" : "completed";

  const endedAt = new Date();
  const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    templateId: template.id,
    meetingId: meeting.id,
    name: `${meeting.title} / ${template.name}`,
    status,
    durationSeconds,
    startedAt: startedAt.toISOString(),
    endedAt: status === "completed" || status === "failed" ? endedAt.toISOString() : undefined,
    configSnapshot: template.nodes.map((n) => ({
      nodeId: n.id,
      nodeTitle: n.title,
      configFields: n.configFields.map((f) => ({ ...f }))
    })),
    nodeRuns: allRuns,
    logs
  };
}

export async function executeSingleNodeRun(
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  node: ProductWorkflowNode,
  inputs?: Record<string, unknown>
): Promise<ProductWorkflowRun> {
  const startedAt = new Date();
  const result = await executeNodeByExecutor(node, meeting, inputs);
  const endedAt = new Date();
  const status = result.status === "failed" ? "failed" : result.status === "blocked" ? "blocked" : "completed";

  return {
    id: `run-node-${node.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    templateId: template.id,
    meetingId: meeting.id,
    name: `${meeting.title} / ${node.title} 单节点调试`,
    status,
    durationSeconds: Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
    startedAt: startedAt.toISOString(),
    endedAt: status === "completed" || status === "failed" ? endedAt.toISOString() : undefined,
    configSnapshot: [
      {
        nodeId: node.id,
        nodeTitle: node.title,
        configFields: node.configFields.map((field) => ({ ...field }))
      }
    ],
    nodeRuns: [result],
    logs: [
      {
        id: `log-${Date.now()}-${node.id}-single-start`,
        time: logTime(startedAt),
        level: "info",
        message: `${node.title} 单节点调试已启动`,
        nodeId: node.id
      },
      {
        id: `log-${Date.now()}-${node.id}-single-done`,
        time: logTime(endedAt),
        level: result.status === "success" ? "success" : result.status === "blocked" ? "warning" : "error",
        message:
          result.status === "success"
            ? `${node.title} 单节点调试完成`
            : result.errorMessage ?? `${node.title} 单节点调试未完成`,
        nodeId: node.id
      }
    ]
  };
}

export async function advanceWorkflowExecution(
  run: ProductWorkflowRun,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  resolutionNote: string,
  _retryConfig?: { maxRetries?: number; retryDelayMs?: number }
): Promise<ProductWorkflowRun> {
  const now = new Date();
  const nextLogs = [...run.logs];
  const nextNodeRuns = run.nodeRuns.map((nodeRun) => {
    if (nodeRun.status === "blocked") {
      nextLogs.push({
        id: `log-${Date.now()}-${nodeRun.nodeId}-resolved`,
        time: logTime(now),
        level: "success",
        message: `人工处理完成：${resolutionNote}`,
        nodeId: nodeRun.nodeId
      });

      return {
        ...nodeRun,
        status: "success" as const,
        endedAt: now.toISOString(),
        outputPayload: {
          ...nodeRun.outputPayload,
          manualResolution: true,
          resolutionNote
        },
        errorMessage: undefined
      };
    }

    return nodeRun;
  });

  // Execute remaining pending nodes
  const pendingNodeIds = nextNodeRuns
    .filter((r) => r.status === "pending")
    .map((r) => r.nodeId);

  if (pendingNodeIds.length > 0) {
    const pendingNodes = template.nodes.filter((n) => pendingNodeIds.includes(n.id));

    for (let i = 0; i < pendingNodes.length; i++) {
      const node = pendingNodes[i]!;
      const timestamp = new Date(now.getTime() + i * 1000);
      const result = await executeNodeByExecutor(node, meeting);

      const nodeRunIndex = nextNodeRuns.findIndex((r) => r.nodeId === node.id);
      if (nodeRunIndex >= 0) {
        const resolvedRun: ProductNodeRun = {
          ...result,
          startedAt: result.startedAt ?? timestamp.toISOString(),
          endedAt: result.endedAt ?? new Date(timestamp.getTime() + 1000).toISOString()
        };
        nextNodeRuns[nodeRunIndex] = resolvedRun;

        nextLogs.push({
          id: `log-${Date.now()}-${node.id}-continued`,
          time: logTime(timestamp),
          level: "success",
          message: `${node.title} 已继续完成`,
          nodeId: node.id
        });
      }
    }
  }

  const durationSeconds = Math.max(
    run.durationSeconds,
    Math.round((now.getTime() - new Date(run.startedAt).getTime()) / 1000)
  );

  return {
    ...run,
    status: "completed",
    durationSeconds,
    endedAt: now.toISOString(),
    nodeRuns: nextNodeRuns,
    logs: nextLogs
  };
}

// ── HELPERS ──

function logTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}


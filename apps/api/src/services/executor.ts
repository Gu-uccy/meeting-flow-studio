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
  callLLMWithStructuredOutput,
  isLlmTimeoutError,
  extractConfigValues,
  isLLMAvailable
} from "./llm.js";
import { retrieveMeetingKnowledge } from "./knowledgeRetrieval.js";
import {
  applyNodeOutputMapping,
  buildMeetingPayload,
  buildWorkflowRuntimeContext,
  collectWorkflowRunUsage,
  createWorkflowRuntimeStore,
  getPathValue,
  hydrateRuntimeStoreFromCompletedNodes,
  restoreWorkflowRuntimeStore,
  seedNodeResultsFromRuns
} from "./runtimeMapping.js";
import {
  buildStructuredOutputSchemaPrompt,
  extractJsonObject,
  validateStructuredOutput
} from "./structuredOutput.js";
import { syncGoogleCalendarEvent } from "./googleCalendar.js";
import { syncFeishuCalendarEvent } from "./feishuCalendar.js";
import { resolvePublishedNodeRuntime } from "./nodeAgentRuntime.js";

export type WorkflowExecutionOptions = {
  apiKey?: string;
  baseUrl?: string;
  userId?: string;
};

export type WorkflowExecutionHooks = {
  runId?: string;
  resumeFrom?: ProductWorkflowRun;
  isCancelled?: () => boolean;
  onProgress?: (run: ProductWorkflowRun) => void | Promise<void>;
};

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

function applyNodeOutputSchema(node: ProductWorkflowNode, _meeting: MeetingRecord, outputPayload: RuntimePayload): RuntimePayload {
  const schema = getNodeOutputSchema(node);
  if (schema.length === 0) {
    return outputPayload;
  }

  const rawStructuredOutput =
    outputPayload.structuredOutput && typeof outputPayload.structuredOutput === "object" && !Array.isArray(outputPayload.structuredOutput)
      ? (outputPayload.structuredOutput as Record<string, unknown>)
      : typeof outputPayload.llmContent === "string"
        ? extractJsonObject(outputPayload.llmContent)
        : null;

  if (
    rawStructuredOutput === null &&
    typeof outputPayload.llmContent === "string" &&
    outputPayload.agentRuntime === "llm"
  ) {
    const preview = outputPayload.llmContent.trim().slice(0, 280);
    throw new Error(`模型未返回合法 JSON，无法匹配 Output Schema。原始输出：${preview}${outputPayload.llmContent.length > 280 ? "..." : ""}`);
  }

  if (!rawStructuredOutput) {
    if (typeof outputPayload.llmContent === "string") {
      throw new Error("模型未返回合法 JSON，无法匹配 Output Schema");
    }
    throw new Error("AI 节点未返回可用输出，无法匹配 Output Schema");
  }

  const rawOutput = rawStructuredOutput;
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

function shouldRunAgentNode(node: ProductWorkflowNode) {
  return node.executor?.type === "aiApplication" || node.kind === "ai";
}

async function executeAgentNode(
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputPayload: RuntimePayload,
  options?: WorkflowExecutionOptions
): Promise<RuntimePayload> {
  const config = extractConfigValues(node);
  const meetingCtx = buildMeetingContext(meeting);
  const outputSchema = getNodeOutputSchema(node);
  const schemaPrompt = buildStructuredOutputSchemaPrompt(outputSchema);
  const renderedAgentPrompt = node.agentPromptConfig
    ? buildNodeAgentPrompt(node.agentPromptConfig, node, meeting, inputPayload)
    : null;
  let prompt = renderedAgentPrompt?.userPrompt ?? buildAINodePrompt(config, meetingCtx);
  const systemPrompt = [renderedAgentPrompt?.systemPrompt, schemaPrompt].filter(Boolean).join("\n\n");
  if (!renderedAgentPrompt && schemaPrompt) {
    prompt = `${prompt}\n\n${schemaPrompt}`;
  }
  const model = node.agentPromptConfig?.model ?? config["model"] ?? "gpt-4o-mini";
  const temperature = node.agentPromptConfig?.temperature ?? config["temperature"] ?? 0.5;

  if (!isLLMAvailable(options?.apiKey)) {
    throw new Error("未配置 AI API Key，AI 节点无法执行。请在账号设置中填写 OpenAI 兼容密钥，或配置 AI_API_KEY / OPENAI_API_KEY");
  }

  if (outputSchema.length > 0) {
    try {
      const result = await callLLMWithStructuredOutput({
        model,
        prompt,
        systemPrompt: renderedAgentPrompt?.systemPrompt || undefined,
        temperature,
        maxTokens: node.agentPromptConfig?.maxTokens,
        apiKey: options?.apiKey,
        baseUrl: options?.baseUrl,
        userId: options?.userId,
        outputSchema
      });

      return {
        llmContent: result.content,
        llmModel: result.model,
        llmPrompt: prompt,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        agentRuntime: "llm",
        responseFormat: "json_schema_native",
        structuredOutput: result.structuredOutput
      };
    } catch (error) {
      // Timeouts / aborts / hard network failures must not fall through to a second LLM call.
      if (isLlmTimeoutError(error) || (error instanceof Error && /fetch failed|401|403/i.test(error.message))) {
        throw error;
      }
      // Fall back to prompt-guided JSON when native schema is unavailable.
    }
  }

  const result = await callLLM({
    model,
    prompt,
    systemPrompt: systemPrompt || undefined,
    temperature,
    maxTokens: node.agentPromptConfig?.maxTokens,
    apiKey: options?.apiKey,
    baseUrl: options?.baseUrl,
    userId: options?.userId
  });

  return {
    llmContent: result.content,
    llmModel: result.model,
    llmPrompt: prompt,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    agentRuntime: "llm",
    responseFormat: outputSchema.length > 0 ? "json_schema" : "text"
  };
}

async function executeToolPresetNode(
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputPayload: RuntimePayload
): Promise<RuntimePayload> {
  const toolPreset = configValue(node, "toolPreset");
  const userId = meeting.ownerUserId || "system";

  if (toolPreset === "google-calendar") {
    try {
      const externalCalendar = await syncGoogleCalendarEvent(userId, meeting);
      return {
        channel: "google-calendar",
        externalCalendar,
        meetingId: meeting.id,
        syncStatus: "success",
        toolPreset,
        toolResult: {
          eventId: externalCalendar.eventId,
          hangoutLink: externalCalendar.hangoutLink,
          provider: externalCalendar.provider,
          startAt: meeting.startAt,
          title: meeting.title
        },
        message: "已同步到 Google Calendar"
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Google Calendar 同步失败");
    }
  }

  if (toolPreset === "feishu-calendar") {
    try {
      const { externalCalendar, externalMeeting } = await syncFeishuCalendarEvent(userId, meeting);
      return {
        channel: "feishu-calendar",
        externalCalendar,
        externalMeeting,
        meetingId: meeting.id,
        syncStatus: "success",
        toolPreset,
        toolResult: {
          eventId: externalCalendar.eventId,
          meetingUrl: externalMeeting.meetingUrl,
          provider: externalCalendar.provider,
          recordingStatus: externalMeeting.recordingStatus,
          startAt: meeting.startAt,
          title: meeting.title
        },
        message: externalMeeting.meetingUrl
          ? "已同步到飞书日历并绑定视频会议"
          : "已同步到飞书日历"
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "飞书日历同步失败");
    }
  }

  if (configValue(node, "toolUrl")) {
    return executeHttpToolNode(node, meeting, inputPayload);
  }

  return {
    actionItems: meeting.actionItems.length,
    channels: configValue(node, "channels") || "Teams、邮件、任务系统",
    notifications: Object.values(meeting.notifications).filter(Boolean).length,
    toolPreset: toolPreset || "notification"
  };
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
  inputs?: Record<string, unknown>,
  options?: WorkflowExecutionOptions
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
        outputPayload = await executeAgentNode(node, meeting, inputPayload, options);
        break;
      }

      case "knowledge": {
        const retrieval = await retrieveMeetingKnowledge(meeting, {
          maxDocs: Number(configValue(node, "maxDocs")) || 8,
          missingPolicy: configValue(node, "missingPolicy"),
          sources: configValue(node, "sources")
        });
        const enrichedInput = {
          ...inputPayload,
          citations: retrieval.citations,
          contextPack: retrieval.contextPack
        };

        if (shouldRunAgentNode(node) && node.agentPromptConfig) {
          const agentOutput = await executeAgentNode(node, meeting, enrichedInput, options);
          outputPayload = { ...retrieval, ...agentOutput };
        } else {
          outputPayload = retrieval;
        }
        break;
      }

      case "decision":
        if (shouldRunAgentNode(node) && node.agentPromptConfig) {
          outputPayload = await executeAgentNode(node, meeting, inputPayload, options);
        } else {
          outputPayload = {
            routeDecision:
              meeting.type === "client" || meeting.attendeeCount > 5
                ? "needs_review"
                : "auto_approved"
          };
        }
        break;

      case "action":
        outputPayload = await executeToolPresetNode(node, meeting, inputPayload);
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
  inputs?: Record<string, unknown>,
  options?: WorkflowExecutionOptions
): Promise<ProductNodeRun> {
  const { node: runtimeNode, publishedVersion } = resolvePublishedNodeRuntime(node);
  const executor = runtimeNode.executor ?? node.executor;
  const startedAt = new Date();

  if (executor?.type === "manual") {
    return {
      nodeId: node.id,
      status: "blocked",
      startedAt: startedAt.toISOString(),
      inputPayload: buildNodeInputPayload(runtimeNode, meeting, inputs),
      errorMessage: `${runtimeNode.title} 等待人工处理`
    };
  }

  const result = await executeNodeByKind(runtimeNode, meeting, inputs, options);

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
      agentVersionId: publishedVersion?.id ?? "",
      agentVersion: publishedVersion?.version ?? "",
      agentVersionStatus: publishedVersion?.status ?? ""
    }
  };
}

function nodeRequiresMeetingRecording(node: ProductWorkflowNode) {
  const flag = configValue(node, "requireRecording").toLowerCase();
  if (flag === "关闭" || flag === "false" || flag === "0" || flag === "off") {
    return false;
  }
  if (flag === "开启" || flag === "true" || flag === "1" || flag === "on") {
    return true;
  }
  return node.id === "minutes" || node.outputs.includes("minutesDraft") || node.title.includes("纪要");
}

function hasReadyMeetingRecording(meeting: MeetingRecord) {
  return meeting.externalMeeting?.recordingStatus === "ready";
}

function getBlockingReason(node: ProductWorkflowNode, meeting: MeetingRecord): string {
  if (nodeRequiresMeetingRecording(node) && !hasReadyMeetingRecording(meeting)) {
    const status = meeting.externalMeeting?.recordingStatus ?? "none";
    const detail = meeting.externalMeeting?.statusMessage?.trim();
    if (status === "pending") {
      return detail || "飞书会议录音尚未就绪，请会后点击「刷新录制状态」后再继续";
    }
    if (status === "failed") {
      return detail || "飞书会议录音拉取失败，请检查授权与会议绑定后重试";
    }
    return "整理纪要需要飞书会议录音。请先同步飞书并开启视频会议，会后刷新录制状态至就绪";
  }
  if (node.id === "context" && !meeting.notes.trim()) {
    return "缺少会前材料或背景说明";
  }
  if (node.id === "policy" && meeting.type === "client" && meeting.priority === "high") {
    return "客户高优先级会议需要负责人审批";
  }
  return "";
}

function isNonRetryableNodeError(message: string) {
  const normalized = message.toLowerCase();
  return (
    isLlmTimeoutError(new Error(message)) ||
    normalized.includes("fetch failed") ||
    normalized.includes("未配置 ai api key") ||
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("invalid api key") ||
    normalized.includes("incorrect api key")
  );
}

async function executeNode(
  nodeInfo: ExecutionNode,
  meeting: MeetingRecord,
  retryConfig: { maxRetries: number; retryDelayMs: number },
  inputs?: Record<string, unknown>,
  options?: WorkflowExecutionOptions
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

    const result = await executeNodeByExecutor(node, meeting, inputs, options);
    if (result.status === "success" || result.status === "blocked" || result.status === "skipped") {
      return result;
    }

    lastError = new Error(result.errorMessage ?? "节点执行失败");
    // Timeouts / auth / hard network failures won't recover by retrying; avoid multiplying latency.
    if (isNonRetryableNodeError(lastError.message)) {
      return {
        ...result,
        status: "failed",
        errorMessage: lastError.message
      };
    }
  }

  return {
    nodeId: node.id,
    status: "failed",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    errorMessage: lastError?.message ?? "节点在重试后仍然失败"
  };
}

function buildWorkflowConfigSnapshot(template: ProductWorkflowTemplate) {
  return template.nodes.map((node) => ({
    nodeId: node.id,
    nodeTitle: node.title,
    configFields: node.configFields.map((field) => ({ ...field }))
  }));
}

function buildNodeRunsSnapshot(
  plan: ExecutionNode[],
  nodeResults: Map<string, ProductNodeRun>,
  currentWave: number | null
): ProductNodeRun[] {
  return plan.map((entry) => {
    const existing = nodeResults.get(entry.node.id);
    if (existing) {
      return existing;
    }

    if (currentWave !== null && entry.wave === currentWave) {
      return { nodeId: entry.node.id, status: "running" };
    }

    if (currentWave !== null && entry.wave > currentWave) {
      return { nodeId: entry.node.id, status: "pending" };
    }

    return { nodeId: entry.node.id, status: "pending" };
  });
}

function assembleWorkflowRun(params: {
  runId: string;
  meeting: MeetingRecord;
  template: ProductWorkflowTemplate;
  startedAt: Date;
  status: ProductWorkflowRun["status"];
  nodeResults: Map<string, ProductNodeRun>;
  plan: ExecutionNode[];
  logs: ProductRunLog[];
  runtimeStore: Record<string, unknown>;
  currentWave?: number | null;
  endedAt?: Date;
}): ProductWorkflowRun {
  const allRuns = buildNodeRunsSnapshot(params.plan, params.nodeResults, params.currentWave ?? null);
  const endedAt = params.endedAt ?? new Date();
  const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - params.startedAt.getTime()) / 1000));

  return {
    id: params.runId,
    templateId: params.template.id,
    meetingId: params.meeting.id,
    name: `${params.meeting.title} / ${params.template.name}`,
    status: params.status,
    durationSeconds,
    startedAt: params.startedAt.toISOString(),
    endedAt: params.status === "running" ? undefined : endedAt.toISOString(),
    configSnapshot: buildWorkflowConfigSnapshot(params.template),
    nodeRuns: allRuns,
    logs: params.logs,
    runtimeSnapshot: params.runtimeStore,
    usage: collectWorkflowRunUsage(allRuns)
  };
}

export function buildInitialWorkflowRun(
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  runId: string
): ProductWorkflowRun {
  const startedAt = new Date();
  const { plan } = buildExecutionPlan(template);

  return assembleWorkflowRun({
    runId,
    meeting,
    template,
    startedAt,
    status: "running",
    nodeResults: new Map(),
    plan,
    logs: [
      {
        id: `log-${Date.now()}-start`,
        time: logTime(startedAt),
        level: "info",
        message: `流程 "${template.name}" 已启动`
      }
    ],
    runtimeStore: createWorkflowRuntimeStore(meeting),
    currentWave: 0
  });
}

function seedResumeState(
  resumeFrom: ProductWorkflowRun,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  plan: ExecutionNode[]
) {
  const nodeResults = new Map<string, ProductNodeRun>();
  const completedIds = new Set(
    resumeFrom.nodeRuns
      .filter((nodeRun) => nodeRun.status === "success" || nodeRun.status === "skipped")
      .map((nodeRun) => nodeRun.nodeId)
  );

  for (const nodeRun of resumeFrom.nodeRuns) {
    if (completedIds.has(nodeRun.nodeId)) {
      nodeResults.set(nodeRun.nodeId, nodeRun);
    }
  }

  const resumeWave = plan.find((entry) => !completedIds.has(entry.node.id))?.wave ?? 0;
  const runtimeStore = restoreWorkflowRuntimeStore(meeting, resumeFrom.runtimeSnapshot);
  hydrateRuntimeStoreFromCompletedNodes(template, [...nodeResults.values()], runtimeStore);

  return {
    nodeResults,
    resumeWave,
    logs: [...resumeFrom.logs],
    startedAt: new Date(resumeFrom.startedAt),
    runtimeStore
  };
}

// ── MAIN EXECUTOR ──

export async function executeWorkflowRun(
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  retryConfig?: { maxRetries?: number; retryDelayMs?: number },
  options?: WorkflowExecutionOptions,
  hooks?: WorkflowExecutionHooks
): Promise<ProductWorkflowRun> {
  const runId = hooks?.runId ?? `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const maxRetries = retryConfig?.maxRetries ?? 2;
  const retryDelayMs = retryConfig?.retryDelayMs ?? 1000;
  const { plan, hasCycle } = buildExecutionPlan(template);

  const resumeState = hooks?.resumeFrom
    ? seedResumeState(hooks.resumeFrom, meeting, template, plan)
    : null;

  const startedAt = resumeState?.startedAt ?? new Date();
  const logs: ProductRunLog[] = resumeState?.logs ?? [];
  const nodeResults = resumeState?.nodeResults ?? new Map<string, ProductNodeRun>();
  const runtimeStore = resumeState?.runtimeStore ?? createWorkflowRuntimeStore(meeting);
  const startWave = resumeState?.resumeWave ?? 0;

  if (!resumeState) {
    logs.push({
      id: `log-${Date.now()}-start`,
      time: logTime(startedAt),
      level: "info",
      message: `流程 "${template.name}" 已启动`
    });
  }

  if (hasCycle) {
    logs.push({
      id: `log-${Date.now()}-cycle`,
      time: logTime(new Date()),
      level: "warning",
      message: "检测到画布存在循环，循环节点将按顺序补充执行"
    });
  }

  const emitProgress = async (status: ProductWorkflowRun["status"], currentWave: number | null, endedAt?: Date) => {
    if (!hooks?.onProgress) {
      return;
    }

    await hooks.onProgress(
      assembleWorkflowRun({
        runId,
        meeting,
        template,
        startedAt,
        status,
        nodeResults,
        plan,
        logs,
        runtimeStore,
        currentWave,
        endedAt
      })
    );
  };

  // Execute by waves
  const maxWave = Math.max(...plan.map((n) => n.wave), 0);

  for (let wave = startWave; wave <= maxWave; wave++) {
    if (hooks?.isCancelled?.()) {
      logs.push({
        id: `log-${Date.now()}-cancel`,
        time: logTime(new Date()),
        level: "warning",
        message: "流程已被用户取消"
      });

      const cancelledRun = assembleWorkflowRun({
        runId,
        meeting,
        template,
        startedAt,
        status: "failed",
        nodeResults,
        plan,
        logs,
        runtimeStore,
        currentWave: null,
        endedAt: new Date()
      });

      await emitProgress("failed", null, new Date());
      return cancelledRun;
    }

    const waveNodes = plan.filter((n) => n.wave === wave);
    if (waveNodes.length === 0) continue;

    await emitProgress("running", wave);

    const runtimeContext = buildWorkflowRuntimeContext(meeting, nodeResults, runtimeStore);
    const wavePromises = waveNodes.map(async (nodeInfo) => {
      const existing = nodeResults.get(nodeInfo.node.id);
      if (existing && (existing.status === "success" || existing.status === "skipped")) {
        return { nodeId: nodeInfo.node.id, result: existing };
      }

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

      const result = await executeNode(nodeInfo, meeting, { maxRetries, retryDelayMs }, runtimeContext, options);

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
      if (result.status === "success" && result.outputPayload) {
        const nodeInfo = waveNodes.find((entry) => entry.node.id === nodeId);
        if (nodeInfo) {
          const mapped = applyNodeOutputMapping(nodeInfo.node, result.outputPayload, runtimeStore);
          nodeResults.set(nodeId, { ...result, outputPayload: mapped.outputPayload });
          continue;
        }
      }

      nodeResults.set(nodeId, result);
    }

    const waveHasBlocked = waveResults.some(({ result }) => result.status === "blocked");
    const waveHasFailed = waveResults.some(({ result }) => result.status === "failed");
    if (waveHasBlocked || waveHasFailed) {
      break;
    }

    await emitProgress("running", wave + 1 <= maxWave ? wave + 1 : null);
  }

  // Determine overall status
  const allRuns = buildNodeRunsSnapshot(plan, nodeResults, null);
  const hasFailed = allRuns.some((r) => r.status === "failed");
  const hasBlocked = allRuns.some((r) => r.status === "blocked");
  const status = hasFailed ? "failed" : hasBlocked ? "blocked" : "completed";
  const endedAt = new Date();

  const finalRun = assembleWorkflowRun({
    runId,
    meeting,
    template,
    startedAt,
    status,
    nodeResults,
    plan,
    logs,
    runtimeStore,
    currentWave: null,
    endedAt
  });

  await emitProgress(status, null, endedAt);
  return finalRun;
}

export async function resumeWorkflowRun(
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  retryConfig?: { maxRetries?: number; retryDelayMs?: number },
  options?: WorkflowExecutionOptions,
  hooks?: WorkflowExecutionHooks
): Promise<ProductWorkflowRun> {
  if (!hooks?.resumeFrom) {
    throw new Error("断点续跑需要传入 resumeFrom 运行记录");
  }

  return executeWorkflowRun(meeting, template, retryConfig, options, hooks);
}

export function prepareAdvanceWorkflowRun(
  run: ProductWorkflowRun,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  resolutionNote: string
): ProductWorkflowRun {
  const now = new Date();
  const nextLogs = [...run.logs];
  const runtimeStore = restoreWorkflowRuntimeStore(meeting, run.runtimeSnapshot);
  const nodeResults = run.runtimeSnapshot
    ? seedNodeResultsFromRuns(run.nodeRuns)
    : hydrateRuntimeStoreFromCompletedNodes(template, run.nodeRuns, runtimeStore);

  const nextNodeRuns = run.nodeRuns.map((nodeRun) => {
    if (nodeRun.status !== "blocked") {
      return nodeRun;
    }

    nextLogs.push({
      id: `log-${Date.now()}-${nodeRun.nodeId}-resolved`,
      time: logTime(now),
      level: "success",
      message: `人工处理完成：${resolutionNote}`,
      nodeId: nodeRun.nodeId
    });

    const node = template.nodes.find((entry) => entry.id === nodeRun.nodeId);
    const resolvedOutputPayload = {
      ...(nodeRun.outputPayload ?? {}),
      manualResolution: true,
      resolutionNote
    };
    const resolvedRun: ProductNodeRun = {
      ...nodeRun,
      status: "success",
      endedAt: now.toISOString(),
      outputPayload: resolvedOutputPayload,
      errorMessage: undefined
    };

    if (node && resolvedOutputPayload) {
      const mapped = applyNodeOutputMapping(node, resolvedOutputPayload, runtimeStore);
      const finalRun = { ...resolvedRun, outputPayload: mapped.outputPayload };
      nodeResults.set(nodeRun.nodeId, finalRun);
      return finalRun;
    }

    nodeResults.set(nodeRun.nodeId, resolvedRun);
    return resolvedRun;
  });

  const hasPending = nextNodeRuns.some((nodeRun) => nodeRun.status === "pending" || nodeRun.status === "running");
  const hasFailed = nextNodeRuns.some((nodeRun) => nodeRun.status === "failed");
  const hasBlocked = nextNodeRuns.some((nodeRun) => nodeRun.status === "blocked");
  const status: ProductWorkflowRun["status"] = hasFailed ? "failed" : hasBlocked ? "blocked" : hasPending ? "running" : "completed";

  return {
    ...run,
    status,
    durationSeconds: Math.max(
      run.durationSeconds,
      Math.round((now.getTime() - new Date(run.startedAt).getTime()) / 1000)
    ),
    endedAt: status === "completed" || status === "failed" ? now.toISOString() : undefined,
    nodeRuns: nextNodeRuns,
    logs: nextLogs,
    runtimeSnapshot: runtimeStore,
    usage: collectWorkflowRunUsage(nextNodeRuns)
  };
}

export async function executeSingleNodeRun(
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  node: ProductWorkflowNode,
  inputs?: Record<string, unknown>,
  options?: WorkflowExecutionOptions
): Promise<ProductWorkflowRun> {
  const startedAt = new Date();
  const runtimeStore = createWorkflowRuntimeStore(meeting);
  const runtimeContext = buildWorkflowRuntimeContext(meeting, new Map(), runtimeStore);
  const mergedInputs = { ...runtimeContext, ...inputs };
  const result = await executeNodeByExecutor(node, meeting, mergedInputs, options);
  const finalResult =
    result.status === "success" && result.outputPayload
      ? {
          ...result,
          outputPayload: applyNodeOutputMapping(node, result.outputPayload, runtimeStore).outputPayload
        }
      : result;
  const endedAt = new Date();
  const status = finalResult.status === "failed" ? "failed" : finalResult.status === "blocked" ? "blocked" : "completed";
  const usage = collectWorkflowRunUsage([finalResult]);

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
    nodeRuns: [finalResult],
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
        level: finalResult.status === "success" ? "success" : finalResult.status === "blocked" ? "warning" : "error",
        message:
          finalResult.status === "success"
            ? `${node.title} 单节点调试完成`
            : finalResult.errorMessage ?? `${node.title} 单节点调试未完成`,
        nodeId: node.id
      }
    ],
    runtimeSnapshot: runtimeStore,
    usage
  };
}

export async function advanceWorkflowExecution(
  run: ProductWorkflowRun,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  resolutionNote: string,
  retryConfig?: { maxRetries?: number; retryDelayMs?: number },
  options?: WorkflowExecutionOptions,
  hooks?: WorkflowExecutionHooks
): Promise<ProductWorkflowRun> {
  const preparedRun = prepareAdvanceWorkflowRun(run, meeting, template, resolutionNote);

  if (preparedRun.status !== "running") {
    return preparedRun;
  }

  return executeWorkflowRun(meeting, template, retryConfig, options, {
    ...hooks,
    runId: run.id,
    resumeFrom: preparedRun
  });
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


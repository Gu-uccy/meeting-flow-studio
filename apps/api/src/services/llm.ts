import type { AiApplicationOutputField, AiApplicationPromptConfig, ProductWorkflowNode, MeetingRecord } from "@meeting-flow/shared";
import {
  assertAiServiceConfigured,
  getEnvironmentAiDefaults,
  normalizeAiBaseUrl,
  resolveAiServiceConfig,
  type AiServiceConfig
} from "./aiServiceConfig.js";
import {
  buildStructuredOutputSchemaPrompt,
  extractJsonObject
} from "./structuredOutput.js";

export type LLMCallResult = {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

const MODEL_MAP: Record<string, string> = {
  "会议议程助手": "gpt-4o-mini",
  "claude-sonnet-4": "gpt-4o-mini",
  "claude-sonnet-4-20250514": "gpt-4o-mini",
  "claude-opus-4": "gpt-4o",
  "claude-opus-4-20250514": "gpt-4o",
  "claude-haiku-3": "gpt-4o-mini",
  "claude-haiku-3-20240307": "gpt-4o-mini"
};

const TEMP_MAP: Record<string, number> = {
  "低": 0.1,
  "中": 0.5,
  "高": 0.9
};

function resolveModel(friendlyName: string, fallback: string): string {
  const trimmed = friendlyName.trim();
  if (!trimmed) {
    return fallback;
  }
  if (MODEL_MAP[trimmed]) {
    return MODEL_MAP[trimmed]!;
  }
  if (trimmed.startsWith("claude")) {
    return fallback;
  }
  return trimmed;
}

function resolveTemperature(label: string): number {
  const num = Number(label);
  if (!Number.isNaN(num) && num >= 0 && num <= 1) {
    return num;
  }
  return TEMP_MAP[label] ?? 0.5;
}

export function isLLMAvailable(apiKeyOverride?: string) {
  if (apiKeyOverride?.trim()) {
    return true;
  }
  return Boolean(getEnvironmentAiDefaults().apiKey);
}

async function resolveRuntime(params?: { apiKey?: string; baseUrl?: string; chatModel?: string; userId?: string }) {
  const resolved = await resolveAiServiceConfig(params?.userId);
  const apiKey = params?.apiKey?.trim() || resolved.apiKey;
  const config: AiServiceConfig = {
    ...resolved,
    apiKey,
    baseUrl: normalizeAiBaseUrl(params?.baseUrl || resolved.baseUrl),
    chatModel: params?.chatModel?.trim() || resolved.chatModel,
    keySource: params?.apiKey?.trim() ? (resolved.keySource === "none" ? "user" : resolved.keySource) : resolved.keySource
  };
  assertAiServiceConfigured(config, "AI 能力");
  return config;
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

function extractChatContent(payload: ChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

const LLM_FETCH_TIMEOUT_MS = 12_000;

function createTimeoutError(timeoutMs: number) {
  return new Error(`AI 请求超时（${timeoutMs}ms）`);
}

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = LLM_FETCH_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(createTimeoutError(timeoutMs));
        }, timeoutMs);
      })
    ]);
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.message.includes("超时"))) {
      throw createTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isLlmTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }
  const message = error.message.toLowerCase();
  return message.includes("超时") || message.includes("timeout") || message.includes("aborted");
}

async function createChatCompletion(params: {
  config: AiServiceConfig;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  prompt: string;
  jsonObject?: boolean;
}) {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (params.systemPrompt?.trim()) {
    messages.push({ role: "system", content: params.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: params.prompt });

  return withTimeout(async (signal) => {
    const response = await fetch(`${params.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: params.model,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        messages,
        ...(params.jsonObject ? { response_format: { type: "json_object" } } : {})
      }),
      signal
    });

    const payload = (await response.json()) as ChatCompletionResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `AI Chat 调用失败：${response.status} ${response.statusText}`);
    }

    return {
      content: extractChatContent(payload),
      model: payload.model ?? params.model,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0
    };
  });
}

export async function callLLM(params: {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: string | number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  userId?: string;
}): Promise<LLMCallResult> {
  const config = await resolveRuntime(params);
  const model = resolveModel(params.model, config.chatModel);
  const temperature = resolveTemperature(String(params.temperature ?? 0.5));
  const maxTokens = params.maxTokens ?? 1024;

  return createChatCompletion({
    config,
    model,
    temperature,
    maxTokens,
    systemPrompt: params.systemPrompt,
    prompt: params.prompt
  });
}

export async function callLLMWithStructuredOutput(params: {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: string | number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  userId?: string;
  outputSchema: AiApplicationOutputField[];
}): Promise<LLMCallResult & { structuredOutput: Record<string, unknown> }> {
  if (params.outputSchema.length === 0) {
    const result = await callLLM(params);
    return { ...result, structuredOutput: {} };
  }

  const config = await resolveRuntime(params);
  const model = resolveModel(params.model, config.chatModel);
  const temperature = resolveTemperature(String(params.temperature ?? 0.5));
  const maxTokens = params.maxTokens ?? 1024;
  const schemaPrompt = buildStructuredOutputSchemaPrompt(params.outputSchema);

  const result = await createChatCompletion({
    config,
    model,
    temperature,
    maxTokens,
    systemPrompt: [params.systemPrompt?.trim(), schemaPrompt].filter(Boolean).join("\n\n"),
    prompt: params.prompt,
    jsonObject: true
  });

  const structuredOutput = extractJsonObject(result.content);
  if (!structuredOutput) {
    throw new Error("模型未返回合法 JSON Schema 输出");
  }

  return {
    ...result,
    structuredOutput
  };
}

export function extractConfigValues(node: ProductWorkflowNode): Record<string, string> {
  return Object.fromEntries(
    node.configFields.map((field) => [field.key, field.value])
  );
}

export function buildAINodePrompt(
  nodeConfig: Record<string, string>,
  meetingContext: {
    title: string;
    goal: string;
    attendees: string[];
    agendaItems: string[];
    recordingTranscript?: string;
    recordingUrl?: string;
    recordingStatus?: string;
  }
): string {
  const basePrompt = nodeConfig["prompt"] ?? "请根据以下会议信息生成内容。";

  let prompt = basePrompt;
  prompt = prompt.replace(/\{title\}/g, meetingContext.title);
  prompt = prompt.replace(/\{goal\}/g, meetingContext.goal);
  prompt = prompt.replace(/\{attendees\}/g, meetingContext.attendees.join("、"));
  prompt = prompt.replace(/\{agendaItems\}/g, meetingContext.agendaItems.join("、"));
  prompt = prompt.replace(/\{agendaCount\}/g, String(meetingContext.agendaItems.length));
  prompt = prompt.replace(/\{attendeeCount\}/g, String(meetingContext.attendees.length));

  if (!prompt.includes(meetingContext.title)) {
    prompt = [
      `会议标题：${meetingContext.title}`,
      `会议目标：${meetingContext.goal}`,
      `参会人：${meetingContext.attendees.join("、")}`,
      `议程项：${meetingContext.agendaItems.join("、")}`,
      "",
      prompt
    ].join("\n");
  }

  if (meetingContext.recordingTranscript?.trim()) {
    prompt = `${prompt}\n\n会后转写：\n${meetingContext.recordingTranscript.trim()}`;
  } else if (meetingContext.recordingUrl?.trim()) {
    prompt = `${prompt}\n\n飞书录音链接：${meetingContext.recordingUrl.trim()}\n（录音状态：${meetingContext.recordingStatus ?? "ready"}；请基于会前材料整理，勿臆造未出现的会中结论。）`;
  }

  return prompt;
}

export function buildMeetingContext(meeting: MeetingRecord) {
  return {
    title: meeting.title,
    goal: meeting.meetingGoal,
    attendees: meeting.participants.map((p) => p.name),
    agendaItems: meeting.agendaItems.map((a) => a.title),
    recordingTranscript: meeting.externalMeeting?.transcriptText ?? "",
    recordingUrl: meeting.externalMeeting?.recordingUrl ?? "",
    recordingStatus: meeting.externalMeeting?.recordingStatus ?? "none"
  };
}

function stringifyPromptValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getPathValue(source: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function buildNodeAgentPrompt(
  config: AiApplicationPromptConfig,
  node: ProductWorkflowNode,
  meeting: MeetingRecord,
  inputPayload: Record<string, unknown>
) {
  const context = {
    input: inputPayload,
    inputs: inputPayload,
    meeting: {
      attendeeCount: meeting.attendeeCount,
      meetingGoal: meeting.meetingGoal,
      meetingId: meeting.id,
      participants: meeting.participants.map((participant) => participant.name),
      priority: meeting.priority,
      title: meeting.title,
      type: meeting.type
    },
    node: {
      id: node.id,
      kind: node.kind,
      title: node.title
    }
  };
  const render = (template: string) =>
    template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
      const value = getPathValue(context, path) ?? inputPayload[path];
      return stringifyPromptValue(value);
    });

  return {
    systemPrompt: render(config.systemPrompt),
    userPrompt: render(config.userPrompt)
  };
}

import Anthropic from "@anthropic-ai/sdk";
import type { ProductWorkflowNode, MeetingRecord } from "@meeting-flow/shared";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) {
    return client;
  }

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    return null;
  }

  client = new Anthropic({ apiKey });
  return client;
}

export function isLLMAvailable() {
  return getClient() !== null;
}

const MODEL_MAP: Record<string, string> = {
  "会议议程助手": "claude-sonnet-4-20250514",
  "claude-sonnet-4": "claude-sonnet-4-20250514",
  "claude-opus-4": "claude-opus-4-20250514",
  "claude-haiku-3": "claude-haiku-3-20240307"
};

function resolveModel(friendlyName: string): string {
  return MODEL_MAP[friendlyName] ?? friendlyName;
}

const TEMP_MAP: Record<string, number> = {
  "低": 0.1,
  "中": 0.5,
  "高": 0.9
};

function resolveTemperature(label: string): number {
  const num = Number(label);
  if (!Number.isNaN(num) && num >= 0 && num <= 1) {
    return num;
  }
  return TEMP_MAP[label] ?? 0.5;
}

export type LLMCallResult = {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export async function callLLM(params: {
  model: string;
  prompt: string;
  temperature?: string | number;
  maxTokens?: number;
}): Promise<LLMCallResult> {
  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const model = resolveModel(params.model);
  const temperature = resolveTemperature(String(params.temperature ?? 0.5));
  const maxTokens = params.maxTokens ?? 1024;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: params.prompt }]
  });

  const content = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");

  return {
    content,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens
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

  // Add meeting context if not already in the prompt
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

  return prompt;
}

export function buildMeetingContext(meeting: MeetingRecord) {
  return {
    title: meeting.title,
    goal: meeting.meetingGoal,
    attendees: meeting.participants.map((p) => p.name),
    agendaItems: meeting.agendaItems.map((a) => a.title)
  };
}

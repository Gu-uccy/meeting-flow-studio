import type { MeetingChatMessage, MeetingRecord } from "@meeting-flow/shared";
import { buildMeetingContext, callLLM, isLLMAvailable } from "./llm.js";
import { resolveEmbeddingRuntime } from "./embeddings.js";
import { retrieveMeetingKnowledge } from "./knowledgeRetrieval.js";
import { clearChatMessages, insertChatMessage, listChatMessages } from "../chatStore.js";

function createMessageId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildHistoryPrompt(history: MeetingChatMessage[], nextUserMessage: string) {
  const lines = history
    .slice(-12)
    .map((message) => `${message.role === "user" ? "用户" : "助手"}：${message.content}`);

  lines.push(`用户：${nextUserMessage}`);
  lines.push("助手：");
  return lines.join("\n\n");
}

export async function getMeetingChatMessages(meetingId: string) {
  return listChatMessages(meetingId);
}

export async function resetMeetingChat(meetingId: string) {
  await clearChatMessages(meetingId);
}

export async function sendMeetingChatMessage(input: {
  meeting: MeetingRecord;
  content: string;
  modelApiKey?: string;
  userId?: string;
}) {
  const trimmed = input.content.trim();
  if (!trimmed) {
    throw new Error("消息内容不能为空");
  }

  if (!isLLMAvailable(input.modelApiKey)) {
    throw new Error("未配置 AI API Key，会议对话不可用。请在账号设置中填写 OpenAI 兼容密钥，或配置 AI_API_KEY / OPENAI_API_KEY");
  }

  const now = new Date().toISOString();
  const userMessage: MeetingChatMessage = {
    id: createMessageId(),
    meetingId: input.meeting.id,
    role: "user",
    content: trimmed,
    citations: [],
    createdAt: now
  };

  const history = await listChatMessages(input.meeting.id);
  await insertChatMessage(userMessage);

  let retrievalRuntime = undefined as Awaited<ReturnType<typeof resolveEmbeddingRuntime>> | undefined;
  if (input.userId || input.modelApiKey) {
    try {
      retrievalRuntime = await resolveEmbeddingRuntime(input.userId, {
        apiKey: input.modelApiKey
      });
    } catch {
      retrievalRuntime = undefined;
    }
  }

  const retrieval = retrievalRuntime
    ? await retrieveMeetingKnowledge(input.meeting, {
        query: trimmed,
        maxDocs: 6,
        runtime: retrievalRuntime
      })
    : { contextPack: [], citations: [] };
  const meetingContext = buildMeetingContext(input.meeting);
  const citations = retrieval.citations.slice(0, 4).map((item) => ({
    content: item.content,
    kind: item.kind,
    similarity: item.similarity
  }));

  const knowledgeContext = retrieval.contextPack
    .map((item, index) => `[${index + 1}] ${item.content}`)
    .join("\n\n");

  const systemPrompt = [
    "你是会议流程助手，帮助用户理解当前会议背景、流程运行和知识库内容。",
    "请用简洁中文回答，优先引用提供的知识片段；不确定时明确说明。",
    `会议标题：${meetingContext.title}`,
    `会议目标：${meetingContext.goal || "未填写"}`,
    `参会人：${meetingContext.attendees.join("、") || "未填写"}`,
    `议程：${meetingContext.agendaItems.join("、") || "未填写"}`
  ].join("\n");

  const prompt = [
    knowledgeContext ? `知识库参考：\n${knowledgeContext}` : "知识库参考：暂无相关内容。",
    "对话历史：",
    buildHistoryPrompt(history, trimmed)
  ].join("\n\n");

  const llm = await callLLM({
    model: "gpt-4o-mini",
    systemPrompt,
    prompt,
    temperature: 0.4,
    maxTokens: 1200,
    apiKey: input.modelApiKey,
    userId: input.userId
  });

  const assistantMessage: MeetingChatMessage = {
    id: createMessageId(),
    meetingId: input.meeting.id,
    role: "assistant",
    content: llm.content.trim() || "暂时无法生成回复，请稍后再试。",
    citations,
    createdAt: new Date().toISOString()
  };

  await insertChatMessage(assistantMessage);
  return { userMessage, assistantMessage };
}

import { getUserAiServiceRecord } from "../aiKeyStore.js";

export const AI_PROVIDER = "openai-compatible" as const;
export type AiProviderId = typeof AI_PROVIDER;

export const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AI_CHAT_MODEL = "gpt-4o-mini";
export const DEFAULT_AI_EMBEDDING_MODEL = "text-embedding-3-small";

export type AiServiceConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  keyHint: string;
  keySource: "user" | "environment" | "none";
  provider: AiProviderId;
};

export function normalizeAiBaseUrl(value?: string | null) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_AI_BASE_URL;
}

function envApiKey() {
  return (
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    ""
  );
}

export function getEnvironmentAiDefaults() {
  return {
    apiKey: envApiKey(),
    baseUrl: normalizeAiBaseUrl(process.env.AI_BASE_URL),
    chatModel: process.env.AI_CHAT_MODEL?.trim() || DEFAULT_AI_CHAT_MODEL,
    embeddingModel: process.env.AI_EMBEDDING_MODEL?.trim() || DEFAULT_AI_EMBEDDING_MODEL
  };
}

export function isEnvironmentAiConfigured() {
  return Boolean(envApiKey());
}

function keyHintFrom(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "****";
  }
  return `****${trimmed.slice(-4)}`;
}

/** Resolve shared AI runtime (chat + embeddings) for a user or environment-only. */
export async function resolveAiServiceConfig(userId?: string): Promise<AiServiceConfig> {
  const env = getEnvironmentAiDefaults();

  if (userId) {
    const record = await getUserAiServiceRecord(userId);
    if (record?.apiKey) {
      return {
        provider: AI_PROVIDER,
        apiKey: record.apiKey,
        baseUrl: normalizeAiBaseUrl(record.baseUrl || env.baseUrl),
        chatModel: record.chatModel.trim() || env.chatModel,
        embeddingModel: record.embeddingModel.trim() || env.embeddingModel,
        keySource: "user",
        keyHint: record.keyHint || keyHintFrom(record.apiKey)
      };
    }
  }

  if (env.apiKey) {
    return {
      provider: AI_PROVIDER,
      apiKey: env.apiKey,
      baseUrl: env.baseUrl,
      chatModel: env.chatModel,
      embeddingModel: env.embeddingModel,
      keySource: "environment",
      keyHint: keyHintFrom(env.apiKey)
    };
  }

  return {
    provider: AI_PROVIDER,
    apiKey: "",
    baseUrl: env.baseUrl,
    chatModel: env.chatModel,
    embeddingModel: env.embeddingModel,
    keySource: "none",
    keyHint: ""
  };
}

export function assertAiServiceConfigured(config: AiServiceConfig, capability = "AI 能力") {
  if (!config.apiKey) {
    throw new Error(
      `未配置 AI API Key，${capability}不可用。请在账号设置中填写 OpenAI 兼容密钥，或配置 AI_API_KEY / OPENAI_API_KEY`
    );
  }
}

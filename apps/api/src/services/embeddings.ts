import {
  assertAiServiceConfigured,
  getEnvironmentAiDefaults,
  isEnvironmentAiConfigured,
  normalizeAiBaseUrl,
  resolveAiServiceConfig,
  type AiServiceConfig
} from "./aiServiceConfig.js";

export type EmbeddingProvider = string;

const OPENAI_EMBEDDING_DIMENSIONS = 1536;
const LOCAL_EMBEDDING_DIMENSIONS = 384;

export type EmbeddingRuntime = {
  apiKey: string;
  baseUrl: string;
  embeddingModel: string;
};

function tokenize(text: string) {
  return text.toLowerCase().match(/[\u4e00-\u9fff]|[a-z0-9_]+/g) ?? [];
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude <= 1e-8) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

/** 仅用于单元测试中的向量几何校验，不作为运行时回退。 */
export function embedTextLocal(text: string, dimensions = LOCAL_EMBEDDING_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);

  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[index]! += sign * (1 + token.length / 10);
  }

  return normalizeVector(vector);
}

export function isEmbeddingAvailable(apiKeyOverride?: string) {
  if (apiKeyOverride?.trim()) {
    return true;
  }
  return isEnvironmentAiConfigured();
}

export function assertEmbeddingAvailable(apiKeyOverride?: string) {
  if (!isEmbeddingAvailable(apiKeyOverride)) {
    throw new Error(
      "未配置 AI API Key，知识库向量检索不可用。请在账号设置中填写 OpenAI 兼容密钥，或配置 AI_API_KEY / OPENAI_API_KEY"
    );
  }
}

export function getEmbeddingProvider(runtime?: EmbeddingRuntime): EmbeddingProvider {
  const model = runtime?.embeddingModel || getEnvironmentAiDefaults().embeddingModel;
  return `openai-compatible:${model}`;
}

function toRuntime(config: AiServiceConfig): EmbeddingRuntime {
  assertAiServiceConfigured(config, "知识库向量检索");
  return {
    apiKey: config.apiKey,
    baseUrl: normalizeAiBaseUrl(config.baseUrl),
    embeddingModel: config.embeddingModel
  };
}

export async function resolveEmbeddingRuntime(userId?: string, override?: Partial<EmbeddingRuntime>) {
  const config = await resolveAiServiceConfig(userId);
  return toRuntime({
    ...config,
    apiKey: override?.apiKey?.trim() || config.apiKey,
    baseUrl: normalizeAiBaseUrl(override?.baseUrl || config.baseUrl),
    embeddingModel: override?.embeddingModel?.trim() || config.embeddingModel
  });
}

async function embedTextsWithCompatibleApi(texts: string[], runtime: EmbeddingRuntime) {
  const response = await fetch(`${runtime.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: texts,
      model: runtime.embeddingModel
    })
  });

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index: number }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Embeddings 调用失败：${response.status} ${response.statusText}`);
  }

  const rows = payload.data ?? [];
  return texts.map((_, index) => {
    const embedding = rows.find((row) => row.index === index)?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error(`Embeddings 返回缺少第 ${index} 条向量`);
    }
    return embedding;
  });
}

export async function embedTexts(texts: string[], runtime?: EmbeddingRuntime) {
  if (texts.length === 0) {
    return [];
  }

  const resolved = runtime ?? toRuntime(await resolveAiServiceConfig());
  return embedTextsWithCompatibleApi(texts, resolved);
}

export async function embedText(text: string, runtime?: EmbeddingRuntime) {
  const [embedding] = await embedTexts([text], runtime);
  if (!embedding) {
    throw new Error("Embeddings 未返回向量");
  }
  return embedding;
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! * left[index]!;
    rightMagnitude += right[index]! * right[index]!;
  }

  if (leftMagnitude <= 1e-8 || rightMagnitude <= 1e-8) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function getEmbeddingDimensions(_provider?: string) {
  return OPENAI_EMBEDDING_DIMENSIONS;
}

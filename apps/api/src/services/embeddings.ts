export type EmbeddingProvider = "openai:text-embedding-3-small" | "local:hash-v1";

const LOCAL_EMBEDDING_DIMENSIONS = 384;

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

export function getEmbeddingProvider(): EmbeddingProvider {
  return process.env.OPENAI_API_KEY?.trim() ? "openai:text-embedding-3-small" : "local:hash-v1";
}

async function embedTextsWithOpenAI(texts: string[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: texts,
      model: "text-embedding-3-small"
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index: number }>;
  };

  const rows = payload.data ?? [];
  return texts.map((_, index) => rows.find((row) => row.index === index)?.embedding ?? embedTextLocal(texts[index] ?? ""));
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) {
    return [];
  }

  if (getEmbeddingProvider() === "openai:text-embedding-3-small") {
    try {
      return await embedTextsWithOpenAI(texts);
    } catch {
      return texts.map((text) => embedTextLocal(text));
    }
  }

  return texts.map((text) => embedTextLocal(text));
}

export async function embedText(text: string) {
  const [embedding] = await embedTexts([text]);
  return embedding ?? embedTextLocal(text);
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

export function getEmbeddingDimensions(provider = getEmbeddingProvider()) {
  return provider.startsWith("openai:") ? 1536 : LOCAL_EMBEDDING_DIMENSIONS;
}

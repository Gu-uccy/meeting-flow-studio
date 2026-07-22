import crypto from "node:crypto";
import { withDatabase } from "./lib/db/index.js";
import {
  AI_PROVIDER,
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_CHAT_MODEL,
  DEFAULT_AI_EMBEDDING_MODEL,
  getEnvironmentAiDefaults,
  isEnvironmentAiConfigured,
  normalizeAiBaseUrl,
  type AiProviderId
} from "./services/aiServiceConfig.js";

export type AiProvider = AiProviderId;

export type AiKeyStatus = {
  provider: AiProvider;
  isUserConfigured: boolean;
  isEnvironmentConfigured: boolean;
  keySource: "user" | "environment" | "none";
  keyHint: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  updatedAt: string;
};

export type UserAiServiceRecord = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  keyHint: string;
  updatedAt: string;
};

type KeyRow = {
  user_id: string;
  provider: string;
  encrypted_key: string;
  iv: string | null;
  auth_tag: string | null;
  key_hint: string;
  base_url: string | null;
  chat_model: string | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
};

function encryptionKey() {
  const secret =
    process.env["AI_KEY_ENCRYPTION_SECRET"] ??
    process.env["JWT_SECRET"] ??
    "meeting-flow-dev-secret-change-in-production";

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptApiKey(apiKey: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64")
  };
}

function decryptApiKey(row: Pick<KeyRow, "encrypted_key" | "iv" | "auth_tag">) {
  if (!row.iv || !row.auth_tag) {
    return "";
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(row.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_key, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function keyHint(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "****";
  }

  return `****${trimmed.slice(-4)}`;
}

async function readRow(db: Parameters<Parameters<typeof withDatabase>[0]>[0], userId: string, provider: AiProvider) {
  return db
    .prepare(`
      SELECT user_id, provider, encrypted_key, iv, auth_tag, key_hint, base_url, chat_model, embedding_model, created_at, updated_at
      FROM ai_model_keys
      WHERE user_id = ? AND provider = ?
    `)
    .get<KeyRow>(userId, provider);
}

function toStatus(row: KeyRow | undefined): AiKeyStatus {
  const env = getEnvironmentAiDefaults();
  const isUserConfigured = Boolean(row);
  const isEnvironmentConfigured = isEnvironmentAiConfigured();

  return {
    provider: AI_PROVIDER,
    isUserConfigured,
    isEnvironmentConfigured,
    keySource: isUserConfigured ? "user" : isEnvironmentConfigured ? "environment" : "none",
    keyHint: row?.key_hint ?? "",
    baseUrl: normalizeAiBaseUrl(row?.base_url || env.baseUrl),
    chatModel: row?.chat_model?.trim() || env.chatModel,
    embeddingModel: row?.embedding_model?.trim() || env.embeddingModel,
    updatedAt: row?.updated_at ?? ""
  };
}

export async function getUserAiServiceRecord(userId: string): Promise<UserAiServiceRecord | null> {
  return withDatabase(async (db) => {
    const row = await readRow(db, userId, AI_PROVIDER);
    if (!row) {
      return null;
    }

    const apiKey = decryptApiKey(row);
    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      baseUrl: row.base_url ?? "",
      chatModel: row.chat_model ?? "",
      embeddingModel: row.embedding_model ?? "",
      keyHint: row.key_hint,
      updatedAt: row.updated_at
    };
  });
}

/** @deprecated Prefer getUserAiServiceRecord / resolveAiServiceConfig */
export async function getUserAiApiKey(userId: string, provider: AiProvider = AI_PROVIDER) {
  const record = await getUserAiServiceRecord(userId);
  if (provider !== AI_PROVIDER) {
    return "";
  }
  return record?.apiKey ?? "";
}

export async function getAiKeyStatus(userId: string): Promise<AiKeyStatus> {
  return withDatabase(async (db) => {
    const row = await readRow(db, userId, AI_PROVIDER);
    return toStatus(row ?? undefined);
  });
}

export async function saveUserAiService(params: {
  userId: string;
  apiKey: string;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
}) {
  const trimmed = params.apiKey.trim();
  if (!trimmed) {
    throw new Error("API Key 不能为空");
  }

  const env = getEnvironmentAiDefaults();
  const baseUrl = normalizeAiBaseUrl(params.baseUrl || env.baseUrl);
  const chatModel = (params.chatModel ?? "").trim() || env.chatModel || DEFAULT_AI_CHAT_MODEL;
  const embeddingModel =
    (params.embeddingModel ?? "").trim() || env.embeddingModel || DEFAULT_AI_EMBEDDING_MODEL;

  return withDatabase(async (db) => {
    const existing = await readRow(db, params.userId, AI_PROVIDER);
    const now = new Date().toISOString();
    const encrypted = encryptApiKey(trimmed);

    await db
      .prepare(`
        INSERT INTO ai_model_keys (
          user_id, provider, encrypted_key, iv, auth_tag, key_hint, base_url, chat_model, embedding_model, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, provider) DO UPDATE SET
          encrypted_key = excluded.encrypted_key,
          iv = excluded.iv,
          auth_tag = excluded.auth_tag,
          key_hint = excluded.key_hint,
          base_url = excluded.base_url,
          chat_model = excluded.chat_model,
          embedding_model = excluded.embedding_model,
          updated_at = excluded.updated_at
      `)
      .run(
        params.userId,
        AI_PROVIDER,
        encrypted.encryptedKey,
        encrypted.iv,
        encrypted.authTag,
        keyHint(trimmed),
        baseUrl,
        chatModel,
        embeddingModel,
        existing?.created_at ?? now,
        now
      );

    return {
      provider: AI_PROVIDER,
      isUserConfigured: true,
      isEnvironmentConfigured: isEnvironmentAiConfigured(),
      keySource: "user" as const,
      keyHint: keyHint(trimmed),
      baseUrl,
      chatModel,
      embeddingModel,
      updatedAt: now
    } satisfies AiKeyStatus;
  });
}

/** @deprecated Prefer saveUserAiService */
export async function saveUserAiApiKey(userId: string, apiKey: string) {
  return saveUserAiService({ userId, apiKey });
}

export async function deleteUserAiApiKey(userId: string) {
  await withDatabase(async (db) => {
    await db.prepare("DELETE FROM ai_model_keys WHERE user_id = ? AND provider = ?").run(userId, AI_PROVIDER);
  });

  return getAiKeyStatus(userId);
}

export { DEFAULT_AI_BASE_URL, DEFAULT_AI_CHAT_MODEL, DEFAULT_AI_EMBEDDING_MODEL };

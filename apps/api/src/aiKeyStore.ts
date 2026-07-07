import crypto from "node:crypto";
import { withDatabase } from "./lib/db/index.js";

export type AiProvider = "anthropic";

export type AiKeyRecord = {
  userId: string;
  provider: AiProvider;
  encryptedKey: string;
  iv: string;
  authTag: string;
  keyHint: string;
  createdAt: string;
  updatedAt: string;
};

export type AiKeyStatus = {
  provider: AiProvider;
  isUserConfigured: boolean;
  isEnvironmentConfigured: boolean;
  keySource: "user" | "environment" | "none";
  keyHint: string;
  updatedAt: string;
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

function decryptApiKey(record: Pick<AiKeyRecord, "encryptedKey" | "iv" | "authTag">) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(record.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(record.encryptedKey, "base64")),
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

async function readRecord(db: Parameters<Parameters<typeof withDatabase>[0]>[0], userId: string, provider: AiProvider) {
  return db
    .prepare(`
      SELECT user_id, provider, encrypted_key, iv, auth_tag, key_hint, created_at, updated_at
      FROM ai_model_keys
      WHERE user_id = ? AND provider = ?
    `)
    .get<{
      user_id: string;
      provider: AiProvider;
      encrypted_key: string;
      iv: string;
      auth_tag: string;
      key_hint: string;
      created_at: string;
      updated_at: string;
    }>(userId, provider);
}

function toRecord(row: NonNullable<Awaited<ReturnType<typeof readRecord>>>): AiKeyRecord {
  return {
    userId: row.user_id,
    provider: row.provider,
    encryptedKey: row.encrypted_key,
    iv: row.iv,
    authTag: row.auth_tag,
    keyHint: row.key_hint,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getUserAiApiKey(userId: string, provider: AiProvider = "anthropic") {
  return withDatabase(async (db) => {
    const row = await readRecord(db, userId, provider);
    return row ? decryptApiKey(toRecord(row)) : "";
  });
}

export async function getAiKeyStatus(userId: string, provider: AiProvider = "anthropic"): Promise<AiKeyStatus> {
  return withDatabase(async (db) => {
    const row = await readRecord(db, userId, provider);
    const isUserConfigured = Boolean(row);
    const isEnvironmentConfigured = Boolean(process.env["ANTHROPIC_API_KEY"]);

    return {
      provider,
      isUserConfigured,
      isEnvironmentConfigured,
      keySource: isUserConfigured ? "user" : isEnvironmentConfigured ? "environment" : "none",
      keyHint: row?.key_hint ?? "",
      updatedAt: row?.updated_at ?? ""
    };
  });
}

export async function saveUserAiApiKey(userId: string, apiKey: string, provider: AiProvider = "anthropic") {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API Key 不能为空");
  }

  return withDatabase(async (db) => {
    const existing = await readRecord(db, userId, provider);
    const now = new Date().toISOString();
    const encrypted = encryptApiKey(trimmed);
    const insert = db.prepare(`
      INSERT INTO ai_model_keys (user_id, provider, encrypted_key, iv, auth_tag, key_hint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        encrypted_key = excluded.encrypted_key,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        key_hint = excluded.key_hint,
        updated_at = excluded.updated_at
    `);

    await insert.run(
      userId,
      provider,
      encrypted.encryptedKey,
      encrypted.iv,
      encrypted.authTag,
      keyHint(trimmed),
      existing?.created_at ?? now,
      now
    );

    return {
      provider,
      isUserConfigured: true,
      isEnvironmentConfigured: Boolean(process.env["ANTHROPIC_API_KEY"]),
      keySource: "user" as const,
      keyHint: keyHint(trimmed),
      updatedAt: now
    };
  });
}

export async function deleteUserAiApiKey(userId: string, provider: AiProvider = "anthropic") {
  await withDatabase(async (db) => {
    await db.prepare("DELETE FROM ai_model_keys WHERE user_id = ? AND provider = ?").run(userId, provider);
  });

  return getAiKeyStatus(userId, provider);
}

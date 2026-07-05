import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

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

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const databaseFile = path.join(dataDir, "meetings.db");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function openDatabase() {
  ensureDataDir();
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_model_keys (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      key_hint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, provider)
    )
  `);
  return database;
}

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

function readRecord(database: DatabaseSync, userId: string, provider: AiProvider) {
  return database
    .prepare(`
      SELECT user_id, provider, encrypted_key, iv, auth_tag, key_hint, created_at, updated_at
      FROM ai_model_keys
      WHERE user_id = ? AND provider = ?
    `)
    .get(userId, provider) as
    | {
        user_id: string;
        provider: AiProvider;
        encrypted_key: string;
        iv: string;
        auth_tag: string;
        key_hint: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
}

function toRecord(row: NonNullable<ReturnType<typeof readRecord>>): AiKeyRecord {
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
  const database = openDatabase();

  try {
    const row = readRecord(database, userId, provider);
    return row ? decryptApiKey(toRecord(row)) : "";
  } finally {
    database.close();
  }
}

export async function getAiKeyStatus(userId: string, provider: AiProvider = "anthropic"): Promise<AiKeyStatus> {
  const database = openDatabase();

  try {
    const row = readRecord(database, userId, provider);
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
  } finally {
    database.close();
  }
}

export async function saveUserAiApiKey(userId: string, apiKey: string, provider: AiProvider = "anthropic") {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API Key 不能为空");
  }

  const database = openDatabase();

  try {
    const existing = readRecord(database, userId, provider);
    const now = new Date().toISOString();
    const encrypted = encryptApiKey(trimmed);
    const insert = database.prepare(`
      INSERT INTO ai_model_keys (user_id, provider, encrypted_key, iv, auth_tag, key_hint, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        encrypted_key = excluded.encrypted_key,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        key_hint = excluded.key_hint,
        updated_at = excluded.updated_at
    `);

    insert.run(
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
  } finally {
    database.close();
  }
}

export async function deleteUserAiApiKey(userId: string, provider: AiProvider = "anthropic") {
  const database = openDatabase();

  try {
    database
      .prepare("DELETE FROM ai_model_keys WHERE user_id = ? AND provider = ?")
      .run(userId, provider);
  } finally {
    database.close();
  }

  return getAiKeyStatus(userId, provider);
}

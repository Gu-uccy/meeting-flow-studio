import crypto from "node:crypto";
import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";

export type ServiceKeyRecord = {
  applicationId: string;
  createdAt: string;
  id: string;
  keyHint: string;
  label: string;
  userId: string;
};

export type ServiceKeyAuth = {
  applicationId: string;
  keyId: string;
  userId: string;
};

const SERVICE_KEY_PREFIX = "mfs_sk_";

function hashServiceKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function keyHint(rawKey: string) {
  return `****${rawKey.slice(-4)}`;
}

export function generateServiceKeyValue() {
  return `${SERVICE_KEY_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
}

export function isServiceKey(value: string) {
  return value.startsWith(SERVICE_KEY_PREFIX);
}

export async function createServiceKey(params: {
  applicationId: string;
  userId: string;
  label?: string;
}) {
  const rawKey = generateServiceKeyValue();
  const id = `svc-key-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString();

  await withDatabase(async (db) => {
    await db
      .prepare(`
        INSERT INTO app_service_keys (id, application_id, user_id, key_hash, key_hint, label, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        params.applicationId,
        params.userId,
        hashServiceKey(rawKey),
        keyHint(rawKey),
        params.label?.trim() || "默认调用密钥",
        createdAt
      );
  });

  return {
    key: rawKey,
    record: {
      id,
      applicationId: params.applicationId,
      userId: params.userId,
      keyHint: keyHint(rawKey),
      label: params.label?.trim() || "默认调用密钥",
      createdAt
    } satisfies ServiceKeyRecord
  };
}

export async function listServiceKeys(applicationId: string, userId: string) {
  return withDatabase(async (db) => {
    const orderBy = orderByTimestampColumn("created_at", db.driver);
    const rows = await db
      .prepare(`
        SELECT id, application_id, user_id, key_hint, label, created_at
        FROM app_service_keys
        WHERE application_id = ? AND user_id = ?
        ORDER BY ${orderBy}
      `)
      .all<{
        id: string;
        application_id: string;
        user_id: string;
        key_hint: string;
        label: string;
        created_at: string;
      }>(applicationId, userId);

    return rows.map((row) => ({
      id: row.id,
      applicationId: row.application_id,
      userId: row.user_id,
      keyHint: row.key_hint,
      label: row.label,
      createdAt: row.created_at
    })) satisfies ServiceKeyRecord[];
  });
}

export async function deleteServiceKey(id: string, userId: string) {
  return withDatabase(async (db) => {
    const result = await db.prepare("DELETE FROM app_service_keys WHERE id = ? AND user_id = ?").run(id, userId);
    return result.changes > 0;
  });
}

export async function authenticateServiceKey(rawKey: string): Promise<ServiceKeyAuth | null> {
  if (!isServiceKey(rawKey)) {
    return null;
  }

  return withDatabase(async (db) => {
    const row = await db
      .prepare(`
        SELECT id, application_id, user_id
        FROM app_service_keys
        WHERE key_hash = ?
      `)
      .get<{
        id: string;
        application_id: string;
        user_id: string;
      }>(hashServiceKey(rawKey));

    if (!row) {
      return null;
    }

    return {
      keyId: row.id,
      applicationId: row.application_id,
      userId: row.user_id
    };
  });
}

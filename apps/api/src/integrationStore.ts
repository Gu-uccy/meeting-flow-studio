import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export type IntegrationProvider = "google" | "feishu";

export type IntegrationAccount = {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  createdAt: string;
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
    CREATE TABLE IF NOT EXISTS integration_accounts (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, provider)
    )
  `);
  return database;
}

export async function getIntegrationAccount(userId: string, provider: IntegrationProvider) {
  const database = openDatabase();

  try {
    const row = database
      .prepare("SELECT payload FROM integration_accounts WHERE user_id = ? AND provider = ?")
      .get(userId, provider) as { payload: string } | undefined;

    return row ? (JSON.parse(row.payload) as IntegrationAccount) : undefined;
  } finally {
    database.close();
  }
}

export async function saveIntegrationAccount(account: IntegrationAccount) {
  const database = openDatabase();

  try {
    const insert = database.prepare(`
      INSERT INTO integration_accounts (user_id, provider, payload, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `);

    insert.run(account.userId, account.provider, JSON.stringify(account), account.updatedAt);
  } finally {
    database.close();
  }
}

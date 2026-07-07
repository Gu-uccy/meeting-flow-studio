import { withDatabase } from "./lib/db/index.js";

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

export async function getIntegrationAccount(userId: string, provider: IntegrationProvider) {
  return withDatabase(async (db) => {
    const row = await db
      .prepare("SELECT payload FROM integration_accounts WHERE user_id = ? AND provider = ?")
      .get<{ payload: string }>(userId, provider);

    return row ? (JSON.parse(row.payload) as IntegrationAccount) : undefined;
  });
}

export async function saveIntegrationAccount(account: IntegrationAccount) {
  await withDatabase(async (db) => {
    const insert = db.prepare(`
      INSERT INTO integration_accounts (user_id, provider, payload, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `);

    await insert.run(account.userId, account.provider, JSON.stringify(account), account.updatedAt);
  });
}

import { assertDatabaseConfig, getDatabaseConfig } from "./config.js";
import type { DbClient } from "./client.js";
import { createPostgresDbClient } from "./postgresClient.js";
import { createSqliteDbClient } from "./sqliteClient.js";
import { runMigrations } from "./migrations.js";

let migrationPromise: Promise<void> | null = null;
let migrationKey = "";

function getMigrationKey() {
  const config = getDatabaseConfig();
  return config.driver === "postgres" ? `postgres:${config.databaseUrl}` : `sqlite:${config.sqlitePath}`;
}

async function createDbClient() {
  const config = getDatabaseConfig();
  assertDatabaseConfig(config);

  if (config.driver === "postgres") {
    return createPostgresDbClient(config);
  }

  return createSqliteDbClient(config);
}

async function ensureMigrations(db: DbClient) {
  const key = getMigrationKey();
  if (migrationKey !== key || !migrationPromise) {
    migrationKey = key;
    migrationPromise = runMigrations(db);
  }

  await migrationPromise;
}

export async function withDatabase<T>(fn: (db: DbClient) => Promise<T>) {
  const db = await createDbClient();

  try {
    await ensureMigrations(db);
    return await fn(db);
  } finally {
    await db.close();
  }
}

export async function ensureDatabaseReady() {
  await withDatabase(async () => true);
}

export { getDatabaseConfig, assertDatabaseConfig } from "./config.js";
export type { DbClient, DbStatement } from "./client.js";
export { orderByTimestampColumn } from "./migrations.js";

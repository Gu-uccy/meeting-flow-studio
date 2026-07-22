import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { DatabaseConfig } from "./config.js";
import type { DbClient, DbRunResult, DbStatement } from "./client.js";

let sharedSqliteClient: SqliteDbClient | null = null;

function toSqlParams(params: unknown[]): SQLInputValue[] {
  return params as SQLInputValue[];
}

function createSqliteStatement(database: DatabaseSync, sql: string): DbStatement {
  const statement = database.prepare(sql);

  return {
    async all<T>(...params: unknown[]) {
      return statement.all(...toSqlParams(params)) as T[];
    },
    async get<T>(...params: unknown[]) {
      return statement.get(...toSqlParams(params)) as T | undefined;
    },
    async run(...params: unknown[]) {
      const result = statement.run(...toSqlParams(params)) as { changes: number };
      return { changes: result.changes ?? 0 } satisfies DbRunResult;
    }
  };
}

export class SqliteDbClient implements DbClient {
  readonly driver = "sqlite" as const;
  readonly database: DatabaseSync;

  constructor(config: DatabaseConfig) {
    mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
    this.database = new DatabaseSync(config.sqlitePath);
  }

  async close() {
    this.database.close();
  }

  async exec(sql: string) {
    this.database.exec(sql);
  }

  prepare(sql: string): DbStatement {
    return createSqliteStatement(this.database, sql);
  }

  async transaction<T>(fn: (client: DbClient) => Promise<T>) {
    await this.exec("BEGIN");
    try {
      const result = await fn(this);
      await this.exec("COMMIT");
      return result;
    } catch (error) {
      await this.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createSqliteDbClient(config: DatabaseConfig) {
  if (!sharedSqliteClient) {
    sharedSqliteClient = new SqliteDbClient(config);
    sharedSqliteClient.database.exec("PRAGMA journal_mode=WAL");
    sharedSqliteClient.database.exec("PRAGMA busy_timeout=5000");
  }
  return sharedSqliteClient;
}

export function resetSharedSqliteClient() {
  if (sharedSqliteClient) {
    sharedSqliteClient.database.close();
    sharedSqliteClient = null;
  }
}

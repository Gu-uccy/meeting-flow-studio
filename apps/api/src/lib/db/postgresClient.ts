import pg from "pg";
import type { DatabaseConfig } from "./config.js";
import { convertPlaceholders, type DbClient, type DbRunResult, type DbStatement } from "./client.js";

function createPostgresStatement(client: pg.Client, sql: string): DbStatement {
  const pgSql = convertPlaceholders(sql);

  return {
    async all<T>(...params: unknown[]) {
      const result = await client.query(pgSql, params);
      return result.rows as T[];
    },
    async get<T>(...params: unknown[]) {
      const result = await client.query(pgSql, params);
      return result.rows[0] as T | undefined;
    },
    async run(...params: unknown[]) {
      const result = await client.query(pgSql, params);
      return { changes: result.rowCount ?? 0 } satisfies DbRunResult;
    }
  };
}

export class PostgresDbClient implements DbClient {
  readonly driver = "postgres" as const;
  private readonly client: pg.Client;

  constructor(config: DatabaseConfig) {
    this.client = new pg.Client({
      connectionString: config.databaseUrl,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    });
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.end();
  }

  async exec(sql: string) {
    await this.client.query(sql);
  }

  prepare(sql: string): DbStatement {
    return createPostgresStatement(this.client, sql);
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

export async function createPostgresDbClient(config: DatabaseConfig) {
  const client = new PostgresDbClient(config);
  await client.connect();
  return client;
}

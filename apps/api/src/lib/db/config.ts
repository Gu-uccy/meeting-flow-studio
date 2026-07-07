import path from "node:path";
import { fileURLToPath } from "node:url";

export type DbDriver = "sqlite" | "postgres";

export type DatabaseConfig = {
  driver: DbDriver;
  sqlitePath: string;
  databaseUrl: string;
  poolMax: number;
  ssl: boolean;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSqlitePath = path.resolve(currentDir, "../../../data/meetings.db");

export function getDatabaseConfig(): DatabaseConfig {
  const driver = process.env["DB_DRIVER"] === "postgres" ? "postgres" : "sqlite";

  return {
    driver,
    sqlitePath: process.env["SQLITE_PATH"]?.trim() || defaultSqlitePath,
    databaseUrl: process.env["DATABASE_URL"]?.trim() || "",
    poolMax: Number(process.env["DB_POOL_MAX"] ?? "10"),
    ssl: process.env["DB_SSL"] === "true" || process.env["DATABASE_SSL"] === "true"
  };
}

export function assertDatabaseConfig(config: DatabaseConfig = getDatabaseConfig()) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (config.driver === "postgres" && !config.databaseUrl) {
    throw new Error("生产环境使用 PostgreSQL 时必须设置 DATABASE_URL");
  }
}

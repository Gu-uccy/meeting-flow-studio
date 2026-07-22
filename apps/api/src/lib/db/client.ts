import type { DbDriver } from "./config.js";

export type DbRunResult = {
  changes: number;
};

export interface DbStatement {
  all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined>;
  run(...params: unknown[]): Promise<DbRunResult>;
}

export interface DbClient {
  driver: DbDriver;
  close(): Promise<void>;
  exec(sql: string): Promise<void>;
  prepare(sql: string): DbStatement;
  transaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
}

export function convertPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

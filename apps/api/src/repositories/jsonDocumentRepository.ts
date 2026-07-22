import type { DbClient } from "../lib/db/client.js";
import { orderByTimestampColumn } from "../lib/db/migrations.js";

export type JsonDocumentRepository<T extends { id: string }> = {
  loadAll(): Promise<T[]>;
  replaceAll(items: T[]): Promise<void>;
};

type JsonDocumentRepositoryOptions<T extends { id: string }> = {
  db: DbClient;
  getUpdatedAt: (item: T) => string;
  parse: (payload: string) => T;
  serialize: (item: T) => string;
  table: "meetings" | "meeting_memories" | "workflow_runs" | "workflow_templates" | "users";
  timestampColumn?: "updated_at" | "started_at" | "created_at";
};

export function createJsonDocumentRepository<T extends { id: string }>(
  options: JsonDocumentRepositoryOptions<T>
): JsonDocumentRepository<T> {
  const timestampColumn = options.timestampColumn ?? "updated_at";
  const orderBy = orderByTimestampColumn(timestampColumn, options.db.driver);

  return {
    async loadAll() {
      const rows = await options.db
        .prepare(`SELECT payload FROM ${options.table} ORDER BY ${orderBy}`)
        .all<{ payload: string }>();

      return rows.map((row) => options.parse(row.payload));
    },

    async replaceAll(items: T[]) {
      await options.db.transaction(async (tx) => {
        await tx.exec(`DELETE FROM ${options.table}`);

        const insert = tx.prepare(`
          INSERT INTO ${options.table} (id, payload, ${timestampColumn})
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload = excluded.payload,
            ${timestampColumn} = excluded.${timestampColumn}
        `);

        for (const item of items) {
          await insert.run(item.id, options.serialize(item), options.getUpdatedAt(item));
        }
      });
    }
  };
}

export function createWorkflowRunRepository<T extends { id: string; startedAt: string; endedAt?: string }>(
  options: Omit<JsonDocumentRepositoryOptions<T>, "table" | "timestampColumn"> & {
    getStartedAt: (item: T) => string;
    getUpdatedAt: (item: T) => string;
  }
): JsonDocumentRepository<T> {
  const orderBy = orderByTimestampColumn("started_at", options.db.driver);

  return {
    async loadAll() {
      const rows = await options.db
        .prepare(`SELECT payload FROM workflow_runs ORDER BY ${orderBy}`)
        .all<{ payload: string }>();

      return rows.map((row) => options.parse(row.payload));
    },

    async replaceAll(items: T[]) {
      await options.db.transaction(async (tx) => {
        await tx.exec("DELETE FROM workflow_runs");

        const insert = tx.prepare(`
          INSERT INTO workflow_runs (id, payload, started_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            payload = excluded.payload,
            started_at = excluded.started_at,
            updated_at = excluded.updated_at
        `);

        for (const item of items) {
          await insert.run(
            item.id,
            options.serialize(item),
            options.getStartedAt(item),
            options.getUpdatedAt(item)
          );
        }
      });
    }
  };
}

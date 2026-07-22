import { auditLogEntrySchema, type AuditLogEntry } from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";

export async function appendAuditLog(entry: AuditLogEntry) {
  await withDatabase(async (db) => {
    const insert = db.prepare(`
      INSERT INTO audit_logs (id, workspace_id, payload, created_at)
      VALUES (?, ?, ?, ?)
    `);
    await insert.run(entry.id, entry.workspaceId, JSON.stringify(entry), entry.createdAt);
  });
}

export async function listAuditLogs(options: {
  workspaceId: string;
  meetingId?: string;
  limit?: number;
}) {
  return withDatabase(async (db) => {
    const orderBy = orderByTimestampColumn("created_at", db.driver);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const rows = await db
      .prepare(`SELECT payload FROM audit_logs WHERE workspace_id = ? ORDER BY ${orderBy} LIMIT ?`)
      .all<{ payload: string }>(options.workspaceId, limit);

    const items = rows.map((row) => auditLogEntrySchema.parse(JSON.parse(row.payload)));
    if (!options.meetingId) {
      return items;
    }

    return items.filter((item) => {
      if (item.resourceType === "meeting" && item.resourceId === options.meetingId) {
        return true;
      }
      return item.metadata.meetingId === options.meetingId;
    });
  });
}

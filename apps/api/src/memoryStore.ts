import { meetingMemorySchema, type MeetingMemory, type MeetingRecord } from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";
import type { DbClient } from "./lib/db/client.js";
import { syncVectorKnowledgeIndex } from "./vectorStore.js";

function sortByUpdatedAtDesc(left: MeetingMemory, right: MeetingMemory) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function createMemoryRepository(db: DbClient) {
  const orderBy = orderByTimestampColumn("updated_at", db.driver);

  return {
    async loadAll() {
      const rows = await db
        .prepare(`SELECT payload FROM meeting_memories ORDER BY ${orderBy}`)
        .all<{ payload: string }>();

      return rows.map((row) => meetingMemorySchema.parse(JSON.parse(row.payload)));
    },

    async replaceAll(items: MeetingMemory[]) {
      await db.transaction(async (tx) => {
        await tx.exec("DELETE FROM meeting_memories");

        const insert = tx.prepare(`
          INSERT INTO meeting_memories (id, meeting_id, source_run_id, kind, payload, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            meeting_id = excluded.meeting_id,
            source_run_id = excluded.source_run_id,
            kind = excluded.kind,
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `);

        for (const item of items) {
          await insert.run(
            item.id,
            item.meetingId,
            item.sourceRunId || "",
            item.kind,
            JSON.stringify(item),
            item.updatedAt
          );
        }
      });
    }
  };
}

export async function loadMeetingMemories() {
  return withDatabase(async (db) => {
    const repository = createMemoryRepository(db);
    return (await repository.loadAll()).sort(sortByUpdatedAtDesc);
  });
}

export async function saveMeetingMemories(memories: MeetingMemory[], meetings: MeetingRecord[]) {
  await withDatabase(async (db) => {
    const repository = createMemoryRepository(db);
    await repository.replaceAll(memories);
  });

  await syncVectorKnowledgeIndex(memories, meetings);
}

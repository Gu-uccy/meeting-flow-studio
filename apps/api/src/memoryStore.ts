import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { meetingMemorySchema, type MeetingMemory, type MeetingRecord } from "@meeting-flow/shared";
import { syncVectorKnowledgeIndex } from "./vectorStore.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const databaseFile = path.join(dataDir, "meetings.db");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function sortByUpdatedAtDesc(left: MeetingMemory, right: MeetingMemory) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function openDatabase() {
  ensureDataDir();
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS meeting_memories (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      source_run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.exec("CREATE INDEX IF NOT EXISTS idx_meeting_memories_meeting_id ON meeting_memories(meeting_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_meeting_memories_source_run_id ON meeting_memories(source_run_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_meeting_memories_kind ON meeting_memories(kind)");
  return database;
}

function loadMemoriesFromDatabase(database: DatabaseSync) {
  const rows = database
    .prepare("SELECT payload FROM meeting_memories ORDER BY datetime(updated_at) DESC")
    .all() as Array<{ payload: string }>;

  return rows
    .map((row) => meetingMemorySchema.parse(JSON.parse(row.payload)))
    .sort(sortByUpdatedAtDesc);
}

function replaceMemories(database: DatabaseSync, memories: MeetingMemory[]) {
  const insert = database.prepare(`
    INSERT INTO meeting_memories (id, meeting_id, source_run_id, kind, payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      meeting_id = excluded.meeting_id,
      source_run_id = excluded.source_run_id,
      kind = excluded.kind,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);

  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM meeting_memories");

    for (const memory of memories) {
      insert.run(
        memory.id,
        memory.meetingId,
        memory.sourceRunId,
        memory.kind,
        JSON.stringify(memory),
        memory.updatedAt
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function loadMeetingMemories() {
  const database = openDatabase();

  try {
    return loadMemoriesFromDatabase(database);
  } finally {
    database.close();
  }
}

export async function saveMeetingMemories(memories: MeetingMemory[], meetings: MeetingRecord[] = []) {
  const database = openDatabase();

  try {
    replaceMemories(database, memories);
  } finally {
    database.close();
  }

  await syncVectorKnowledgeIndex(memories, meetings);
}

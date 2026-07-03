import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { meetingRecordSchema, seedMeetings, type MeetingRecord } from "@meeting-flow/shared";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const databaseFile = path.join(dataDir, "meetings.db");
const legacyJsonFile = path.join(dataDir, "meetings.json");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function sortByUpdatedAtDesc(left: MeetingRecord, right: MeetingRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function openDatabase() {
  ensureDataDir();
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return database;
}

function readLegacyMeetings() {
  if (!existsSync(legacyJsonFile)) {
    return null;
  }

  const content = readFileSync(legacyJsonFile, "utf8");
  const parsed = JSON.parse(content) as unknown;
  return meetingRecordSchema.array().parse(parsed);
}

function loadMeetingsFromDatabase(database: DatabaseSync) {
  const rows = database
    .prepare("SELECT payload FROM meetings ORDER BY datetime(updated_at) DESC")
    .all() as Array<{ payload: string }>;

  return rows
    .map((row) => meetingRecordSchema.parse(JSON.parse(row.payload)))
    .sort(sortByUpdatedAtDesc);
}

function replaceMeetings(database: DatabaseSync, meetings: MeetingRecord[]) {
  const insert = database.prepare(`
    INSERT INTO meetings (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);

  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM meetings");

    for (const meeting of meetings) {
      insert.run(meeting.id, JSON.stringify(meeting), meeting.updatedAt);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function loadMeetings() {
  const database = openDatabase();

  try {
    const storedMeetings = loadMeetingsFromDatabase(database);
    if (storedMeetings.length > 0) {
      return storedMeetings;
    }

    const legacyMeetings = readLegacyMeetings();
    if (legacyMeetings && legacyMeetings.length > 0) {
      replaceMeetings(database, legacyMeetings);
      unlinkSync(legacyJsonFile);
      return legacyMeetings.sort(sortByUpdatedAtDesc);
    }

    replaceMeetings(database, seedMeetings);
    return [...seedMeetings].sort(sortByUpdatedAtDesc);
  } finally {
    database.close();
  }
}

export async function saveMeetings(meetings: MeetingRecord[]) {
  const database = openDatabase();

  try {
    replaceMeetings(database, meetings);
    if (existsSync(legacyJsonFile)) {
      unlinkSync(legacyJsonFile);
    }
  } finally {
    database.close();
  }
}

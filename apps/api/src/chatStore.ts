import { meetingChatMessageSchema, type MeetingChatMessage } from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";

function sortByCreatedAtAsc(left: MeetingChatMessage, right: MeetingChatMessage) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

export async function listChatMessages(meetingId: string) {
  return withDatabase(async (db) => {
    const orderBy = db.driver === "postgres" ? "created_at ASC" : "datetime(created_at) ASC";
    const rows = await db
      .prepare(`SELECT payload FROM meeting_chat_messages WHERE meeting_id = ? ORDER BY ${orderBy}`)
      .all<{ payload: string }>(meetingId);

    return rows
      .map((row) => meetingChatMessageSchema.parse(JSON.parse(row.payload)))
      .sort(sortByCreatedAtAsc);
  });
}

export async function insertChatMessage(message: MeetingChatMessage) {
  await withDatabase(async (db) => {
    await db
      .prepare(`
        INSERT INTO meeting_chat_messages (id, meeting_id, payload, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          created_at = excluded.created_at
      `)
      .run(message.id, message.meetingId, JSON.stringify(message), message.createdAt);
  });
}

export async function clearChatMessages(meetingId: string) {
  await withDatabase(async (db) => {
    await db.prepare(`DELETE FROM meeting_chat_messages WHERE meeting_id = ?`).run(meetingId);
  });
}

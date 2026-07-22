import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { meetingRecordSchema, seedMeetings, type MeetingRecord } from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { createJsonDocumentRepository } from "./repositories/jsonDocumentRepository.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const legacyJsonFile = path.join(dataDir, "meetings.json");

function sortByUpdatedAtDesc(left: MeetingRecord, right: MeetingRecord) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function readLegacyMeetings() {
  if (!existsSync(legacyJsonFile)) {
    return null;
  }

  const content = readFileSync(legacyJsonFile, "utf8");
  const parsed = JSON.parse(content) as unknown;
  return meetingRecordSchema.array().parse(parsed);
}

export async function loadMeetings() {
  return withDatabase(async (db) => {
    const repository = createJsonDocumentRepository<MeetingRecord>({
      db,
      table: "meetings",
      parse: (payload) => meetingRecordSchema.parse(JSON.parse(payload)),
      serialize: (meeting) => JSON.stringify(meeting),
      getUpdatedAt: (meeting) => meeting.updatedAt
    });

    const storedMeetings = (await repository.loadAll()).sort(sortByUpdatedAtDesc);
    if (storedMeetings.length > 0) {
      return storedMeetings;
    }

    const legacyMeetings = readLegacyMeetings();
    if (legacyMeetings && legacyMeetings.length > 0) {
      await repository.replaceAll(legacyMeetings);
      unlinkSync(legacyJsonFile);
      return legacyMeetings.sort(sortByUpdatedAtDesc);
    }

    await repository.replaceAll(seedMeetings);
    return [...seedMeetings].sort(sortByUpdatedAtDesc);
  });
}

export async function saveMeetings(meetings: MeetingRecord[]) {
  await withDatabase(async (db) => {
    const repository = createJsonDocumentRepository<MeetingRecord>({
      db,
      table: "meetings",
      parse: (payload) => meetingRecordSchema.parse(JSON.parse(payload)),
      serialize: (meeting) => JSON.stringify(meeting),
      getUpdatedAt: (meeting) => meeting.updatedAt
    });

    await repository.replaceAll(meetings);

    if (existsSync(legacyJsonFile)) {
      unlinkSync(legacyJsonFile);
    }
  });
}

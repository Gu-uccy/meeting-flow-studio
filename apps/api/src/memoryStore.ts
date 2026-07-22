import { meetingMemorySchema, type MeetingMemory, type MeetingRecord } from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { createJsonDocumentRepository } from "./repositories/jsonDocumentRepository.js";
import { syncVectorKnowledgeIndex } from "./vectorStore.js";

function sortByUpdatedAtDesc(left: MeetingMemory, right: MeetingMemory) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function createMemoryRepository(db: Parameters<Parameters<typeof withDatabase>[0]>[0]) {
  return createJsonDocumentRepository<MeetingMemory>({
    db,
    table: "meeting_memories",
    parse: (payload) => meetingMemorySchema.parse(JSON.parse(payload)),
    serialize: (memory) => JSON.stringify(memory),
    getUpdatedAt: (memory) => memory.updatedAt
  });
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

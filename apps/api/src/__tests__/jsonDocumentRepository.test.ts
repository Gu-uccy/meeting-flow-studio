import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { meetingRecordSchema, seedMeetings } from "@meeting-flow/shared";
import { withDatabase } from "../lib/db/index.js";
import { createJsonDocumentRepository } from "../repositories/jsonDocumentRepository.js";

describe("jsonDocumentRepository", () => {
  let tempDbPath = "";
  let previousSqlitePath: string | undefined;

  beforeEach(() => {
    previousSqlitePath = process.env.SQLITE_PATH;
    tempDbPath = path.join(os.tmpdir(), `mfs-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    process.env.SQLITE_PATH = tempDbPath;
  });

  afterEach(() => {
    if (previousSqlitePath) {
      process.env.SQLITE_PATH = previousSqlitePath;
    } else {
      delete process.env.SQLITE_PATH;
    }

    if (tempDbPath && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it("replaces and loads json documents", async () => {
    await withDatabase(async (db) => {
      const repository = createJsonDocumentRepository({
        db,
        table: "meetings",
        parse: (payload) => meetingRecordSchema.parse(JSON.parse(payload)),
        serialize: (meeting) => JSON.stringify(meeting),
        getUpdatedAt: (meeting) => meeting.updatedAt
      });

      await repository.replaceAll(seedMeetings.slice(0, 1));
      const loaded = await repository.loadAll();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe(seedMeetings[0]?.id);
    });
  });
});

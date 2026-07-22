import { describe, expect, it, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { meetingRecordSchema, seedMeetings } from "@meeting-flow/shared";
import { ensureDatabaseReady, withDatabase } from "../lib/db/index.js";
import { createKnowledgeDocument, listKnowledgeDocuments } from "../knowledgeDocumentStore.js";
import { createJsonDocumentRepository } from "../repositories/jsonDocumentRepository.js";
import { createServiceKey, listServiceKeys } from "../serviceKeyStore.js";
import { addSchedule, getAllSchedules, loadSchedules } from "../services/scheduler.js";
import { createUser, findUserByEmail, loadUsers } from "../userStore.js";
import { syncVectorKnowledgeIndex } from "../vectorStore.js";

const runPostgresTests = process.env.RUN_POSTGRES_TESTS === "true";

describe.runIf(runPostgresTests)("postgres integration", () => {
  beforeAll(async () => {
    if (process.env.DB_DRIVER !== "postgres") {
      throw new Error("DB_DRIVER must be postgres for postgres integration tests");
    }

    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error("DATABASE_URL is required for postgres integration tests");
    }

    await ensureDatabaseReady();
    await loadUsers();
  });

  it("runs migrations and persists meeting documents", async () => {
    await withDatabase(async (db) => {
      const repository = createJsonDocumentRepository({
        db,
        table: "meetings",
        parse: (payload) => meetingRecordSchema.parse(JSON.parse(payload)),
        serialize: (meeting) => JSON.stringify(meeting),
        getUpdatedAt: (meeting) => meeting.updatedAt
      });

      const sample = seedMeetings[0];
      if (!sample) {
        throw new Error("Missing seed meeting fixture");
      }

      await repository.replaceAll([sample]);
      const loaded = await repository.loadAll();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe(sample.id);
    });
  });

  it("creates users and service keys", async () => {
    const email = `postgres-${Date.now()}@test.com`;
    const passwordHash = await bcrypt.hash("Test123456", 4);
    const user = await createUser(email, "Postgres Tester", passwordHash);

    const found = await findUserByEmail(email);
    expect(found?.id).toBe(user.id);

    const serviceKey = await createServiceKey({
      applicationId: "app-test-ai",
      userId: user.id,
      label: "postgres integration"
    });

    expect(serviceKey.key.startsWith("mfs_sk_")).toBe(true);

    const keys = await listServiceKeys("app-test-ai", user.id);
    expect(keys.some((item) => item.id === serviceKey.record.id)).toBe(true);
  });

  it("stores knowledge documents and vector chunks", async () => {
    const meeting = seedMeetings[0];
    if (!meeting) {
      throw new Error("Missing seed meeting fixture");
    }

    const document = await createKnowledgeDocument({
      meetingId: meeting.id,
      ownerUserId: "user-admin-001",
      title: "Postgres Doc",
      content: "向量索引应写入 PostgreSQL。"
    });

    const documents = await listKnowledgeDocuments(meeting.id);
    expect(documents.some((item) => item.id === document.id)).toBe(true);
    expect(document.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await syncVectorKnowledgeIndex([], [meeting], [document]);

    await withDatabase(async (db) => {
      const rows = await db
        .prepare("SELECT COUNT(*) AS count FROM knowledge_vector_chunks WHERE meeting_id = ?")
        .get<{ count: string | number }>(meeting.id);

      expect(Number(rows?.count ?? 0)).toBeGreaterThan(0);
    });
  });

  it("persists workflow schedules with boolean enabled flag", async () => {
    await loadSchedules([]);

    const schedule = await addSchedule({
      id: `schedule-pg-${Date.now()}`,
      templateId: "template-weekly-sync",
      cronExpression: "0 9 * * 1",
      enabled: true,
      executionHistory: []
    });

    const schedules = getAllSchedules();
    expect(schedules.some((item) => item.id === schedule.id && item.enabled)).toBe(true);

    await withDatabase(async (db) => {
      const row = await db
        .prepare("SELECT enabled FROM workflow_schedules WHERE id = ?")
        .get<{ enabled: boolean }>(schedule.id);

      expect(row?.enabled).toBe(true);
    });
  });
});

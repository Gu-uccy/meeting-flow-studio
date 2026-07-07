import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";

export type KnowledgeDocument = {
  content: string;
  createdAt: string;
  format: "markdown" | "text";
  id: string;
  meetingId: string;
  ownerUserId: string;
  title: string;
  updatedAt: string;
};

function rowToDocument(row: {
  content: string;
  created_at: string;
  format: string;
  id: string;
  meeting_id: string;
  owner_user_id: string;
  title: string;
  updated_at: string;
}): KnowledgeDocument {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    content: row.content,
    format: row.format === "markdown" ? "markdown" : "text",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listKnowledgeDocuments(meetingId?: string) {
  return withDatabase(async (db) => {
    const orderBy = orderByTimestampColumn("updated_at", db.driver);
    const rows = meetingId
      ? await db
          .prepare(`SELECT * FROM knowledge_documents WHERE meeting_id = ? ORDER BY ${orderBy}`)
          .all<Parameters<typeof rowToDocument>[0]>(meetingId)
      : await db
          .prepare(`SELECT * FROM knowledge_documents ORDER BY ${orderBy}`)
          .all<Parameters<typeof rowToDocument>[0]>();

    return rows.map(rowToDocument);
  });
}

export async function createKnowledgeDocument(params: {
  meetingId: string;
  ownerUserId: string;
  title: string;
  content: string;
  format?: "markdown" | "text";
}) {
  const now = new Date().toISOString();
  const document: KnowledgeDocument = {
    id: `kdoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    meetingId: params.meetingId,
    ownerUserId: params.ownerUserId,
    title: params.title.trim() || "未命名文档",
    content: params.content.trim(),
    format: params.format ?? "text",
    createdAt: now,
    updatedAt: now
  };

  await withDatabase(async (db) => {
    await db
      .prepare(`
        INSERT INTO knowledge_documents (id, meeting_id, owner_user_id, title, content, format, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        document.id,
        document.meetingId,
        document.ownerUserId,
        document.title,
        document.content,
        document.format,
        document.createdAt,
        document.updatedAt
      );
  });

  return document;
}

export async function deleteKnowledgeDocument(id: string) {
  return withDatabase(async (db) => {
    const result = await db.prepare("DELETE FROM knowledge_documents WHERE id = ?").run(id);
    return result.changes > 0;
  });
}

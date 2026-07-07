import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { MeetingMemory, MeetingRecord } from "@meeting-flow/shared";
import {
  cosineSimilarity,
  embedText,
  embedTexts,
  getEmbeddingDimensions,
  getEmbeddingProvider,
  type EmbeddingProvider
} from "./services/embeddings.js";
import { buildVectorChunkId, getTextChunkingOptions, splitTextIntoChunks } from "./services/textChunking.js";

export type VectorChunkRecord = {
  content: string;
  embedding: number[];
  embeddingModel: EmbeddingProvider;
  id: string;
  kind: string;
  meetingId: string;
  sourceId: string;
  sourceType: "memory" | "meeting_notes";
  updatedAt: string;
};

export type VectorSearchHit = VectorChunkRecord & {
  similarity: number;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "./data");
const databaseFile = path.join(dataDir, "meetings.db");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function openDatabase() {
  ensureDataDir();
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_vector_chunks (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding_model TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_vector_chunks_meeting_id ON knowledge_vector_chunks(meeting_id)");
  return database;
}

function serializeEmbedding(embedding: number[]) {
  return JSON.stringify(embedding);
}

function deserializeEmbedding(value: string) {
  const parsed = JSON.parse(value) as number[];
  return Array.isArray(parsed) ? parsed : [];
}

function rowToChunk(row: {
  content: string;
  embedding_json: string;
  embedding_model: string;
  id: string;
  kind: string;
  meeting_id: string;
  source_id: string;
  source_type: string;
  updated_at: string;
}): VectorChunkRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    sourceType: row.source_type as VectorChunkRecord["sourceType"],
    sourceId: row.source_id,
    kind: row.kind,
    content: row.content,
    embeddingModel: row.embedding_model as EmbeddingProvider,
    embedding: deserializeEmbedding(row.embedding_json),
    updatedAt: row.updated_at
  };
}

function buildChunks(memories: MeetingMemory[], meetings: MeetingRecord[]) {
  const chunkingOptions = getTextChunkingOptions();
  const chunks: Array<Omit<VectorChunkRecord, "embedding" | "embeddingModel">> = [];

  for (const memory of memories) {
    if (!memory.content.trim()) {
      continue;
    }

    const parts = splitTextIntoChunks(memory.content, chunkingOptions);
    for (const part of parts) {
      chunks.push({
        id: buildVectorChunkId(memory.id, part.index, parts.length),
        meetingId: memory.meetingId,
        sourceType: "memory",
        sourceId: memory.id,
        kind: memory.kind,
        content: part.content,
        updatedAt: memory.updatedAt
      });
    }
  }

  for (const meeting of meetings) {
    if (!meeting.notes.trim()) {
      continue;
    }

    const parts = splitTextIntoChunks(meeting.notes, chunkingOptions);
    for (const part of parts) {
      chunks.push({
        id: buildVectorChunkId(`meeting-notes-${meeting.id}`, part.index, parts.length),
        meetingId: meeting.id,
        sourceType: "meeting_notes",
        sourceId: meeting.id,
        kind: "summary",
        content: part.content,
        updatedAt: meeting.updatedAt
      });
    }
  }

  return chunks;
}

export async function syncVectorKnowledgeIndex(memories: MeetingMemory[], meetings: MeetingRecord[] = []) {
  const database = openDatabase();
  const provider = getEmbeddingProvider();
  const chunks = buildChunks(memories, meetings);
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM knowledge_vector_chunks");
    const insert = database.prepare(`
      INSERT INTO knowledge_vector_chunks (
        id, meeting_id, source_type, source_id, kind, content, embedding_model, embedding_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    chunks.forEach((chunk, index) => {
      insert.run(
        chunk.id,
        chunk.meetingId,
        chunk.sourceType,
        chunk.sourceId,
        chunk.kind,
        chunk.content,
        provider,
        serializeEmbedding(embeddings[index] ?? []),
        chunk.updatedAt
      );
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }

  return {
    chunkCount: chunks.length,
    chunking: getTextChunkingOptions(),
    embeddingModel: provider,
    dimensions: getEmbeddingDimensions(provider)
  };
}

export async function searchVectorKnowledge(params: {
  meetingId: string;
  query: string;
  topK?: number;
  minSimilarity?: number;
}): Promise<VectorSearchHit[]> {
  const database = openDatabase();
  const query = params.query.trim();
  const topK = Math.max(1, params.topK ?? 6);
  const minSimilarity = params.minSimilarity ?? 0.08;

  try {
    const rows = database
      .prepare(`
        SELECT id, meeting_id, source_type, source_id, kind, content, embedding_model, embedding_json, updated_at
        FROM knowledge_vector_chunks
        WHERE meeting_id = ?
      `)
      .all(params.meetingId) as Array<{
        content: string;
        embedding_json: string;
        embedding_model: string;
        id: string;
        kind: string;
        meeting_id: string;
        source_id: string;
        source_type: string;
        updated_at: string;
      }>;

    if (rows.length === 0 || !query) {
      return [];
    }

    const queryEmbedding = await embedText(query);
    return rows
      .map((row) => {
        const chunk = rowToChunk(row);
        return {
          ...chunk,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
        };
      })
      .filter((hit) => hit.similarity >= minSimilarity)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, topK);
  } finally {
    database.close();
  }
}

export async function getVectorIndexStats() {
  const database = openDatabase();

  try {
    const row = database.prepare("SELECT COUNT(*) as count FROM knowledge_vector_chunks").get() as { count: number };
    return {
      chunkCount: row.count ?? 0,
      chunking: getTextChunkingOptions(),
      embeddingModel: getEmbeddingProvider(),
      dimensions: getEmbeddingDimensions()
    };
  } finally {
    database.close();
  }
}

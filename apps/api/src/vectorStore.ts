import type { MeetingMemory, MeetingRecord } from "@meeting-flow/shared";
import type { KnowledgeDocument } from "./knowledgeDocumentStore.js";
import { withDatabase } from "./lib/db/index.js";
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
  sourceType: "memory" | "meeting_notes" | "document";
  updatedAt: string;
};

export type VectorSearchHit = VectorChunkRecord & {
  similarity: number;
};

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

function buildChunks(memories: MeetingMemory[], meetings: MeetingRecord[], documents: KnowledgeDocument[] = []) {
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

  for (const document of documents) {
    if (!document.content.trim()) {
      continue;
    }

    const parts = splitTextIntoChunks(document.content, chunkingOptions);
    for (const part of parts) {
      chunks.push({
        id: buildVectorChunkId(document.id, part.index, parts.length),
        meetingId: document.meetingId,
        sourceType: "document",
        sourceId: document.id,
        kind: "summary",
        content: `[${document.title}]\n${part.content}`,
        updatedAt: document.updatedAt
      });
    }
  }

  return chunks;
}

export async function syncVectorKnowledgeIndex(
  memories: MeetingMemory[],
  meetings: MeetingRecord[] = [],
  documents: KnowledgeDocument[] = []
) {
  const provider = getEmbeddingProvider();
  const chunks = buildChunks(memories, meetings, documents);
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

  await withDatabase(async (db) => {
    await db.transaction(async (tx) => {
      await tx.exec("DELETE FROM knowledge_vector_chunks");
      const insert = tx.prepare(`
        INSERT INTO knowledge_vector_chunks (
          id, meeting_id, source_type, source_id, kind, content, embedding_model, embedding_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const [index, chunk] of chunks.entries()) {
        await insert.run(
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
      }
    });
  });

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
  const query = params.query.trim();
  const topK = Math.max(1, params.topK ?? 6);
  const minSimilarity = params.minSimilarity ?? 0.08;

  return withDatabase(async (db) => {
    const rows = await db
      .prepare(`
        SELECT id, meeting_id, source_type, source_id, kind, content, embedding_model, embedding_json, updated_at
        FROM knowledge_vector_chunks
        WHERE meeting_id = ?
      `)
      .all<{
        content: string;
        embedding_json: string;
        embedding_model: string;
        id: string;
        kind: string;
        meeting_id: string;
        source_id: string;
        source_type: string;
        updated_at: string;
      }>(params.meetingId);

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
  });
}

export async function getVectorIndexStats() {
  return withDatabase(async (db) => {
    const row = await db.prepare("SELECT COUNT(*) as count FROM knowledge_vector_chunks").get<{ count: number }>();
    return {
      chunkCount: row?.count ?? 0,
      chunking: getTextChunkingOptions(),
      embeddingModel: getEmbeddingProvider(),
      dimensions: getEmbeddingDimensions()
    };
  });
}

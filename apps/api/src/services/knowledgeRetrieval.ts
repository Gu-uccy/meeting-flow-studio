import type { MeetingMemory, MeetingRecord } from "@meeting-flow/shared";
import { loadMeetingMemories } from "../memoryStore.js";
import { getEmbeddingProvider } from "./embeddings.js";
import { searchVectorKnowledge } from "../vectorStore.js";

export type KnowledgeRetrievalOptions = {
  maxDocs?: number;
  missingPolicy?: string;
  query?: string;
  sources?: string;
};

export type KnowledgeRetrievalResult = {
  citations: Array<{
    content: string;
    id: string;
    kind: MeetingMemory["kind"] | "summary";
    similarity?: number;
    updatedAt: string;
  }>;
  contextPack: Array<{
    content: string;
    id: string;
    kind: string;
    similarity?: number;
    source: string;
  }>;
  documents: number;
  embeddingModel: string;
  missingPolicy: string;
  notesReady: boolean;
  retrievalMode: "vector-openai" | "vector-local" | "memory-store";
  sources: string;
  topSimilarity: number;
};

function rankMemories(memories: MeetingMemory[]) {
  return [...memories].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function buildRetrievalQuery(meeting: MeetingRecord, explicitQuery?: string) {
  return [
    explicitQuery?.trim(),
    meeting.meetingGoal,
    meeting.title,
    meeting.notes.trim(),
    meeting.agendaItems.map((item) => item.title).join(" ")
  ]
    .filter(Boolean)
    .join("\n");
}

function retrievalModeFromProvider(provider: string): KnowledgeRetrievalResult["retrievalMode"] {
  return provider.startsWith("openai:") ? "vector-openai" : "vector-local";
}

export function normalizeKnowledgeSources(sources?: string) {
  const normalized = sources?.trim() ?? "";
  if (!normalized) {
    return "meeting_memories,meeting_notes,knowledge_documents";
  }

  if (normalized.includes("meeting_memories") || normalized.includes("meeting_notes") || normalized.includes("knowledge_documents")) {
    return normalized
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",");
  }

  if (/纪要|记忆|memory|notes|文档|CRM/i.test(normalized)) {
    return "meeting_memories,meeting_notes,knowledge_documents";
  }

  return "meeting_memories,meeting_notes,knowledge_documents";
}

async function retrieveWithMemoryStore(
  meeting: MeetingRecord,
  options: Required<Pick<KnowledgeRetrievalOptions, "maxDocs" | "missingPolicy" | "sources">>
): Promise<KnowledgeRetrievalResult> {
  const allMemories = await loadMeetingMemories();
  const meetingMemories = rankMemories(allMemories.filter((memory) => memory.meetingId === meeting.id)).slice(0, options.maxDocs);

  const contextPack: KnowledgeRetrievalResult["contextPack"] = meetingMemories.map((memory) => ({
    id: memory.id,
    kind: memory.kind,
    source: memory.source,
    content: memory.content
  }));

  if (meeting.notes.trim() && options.sources.includes("meeting_notes")) {
    contextPack.unshift({
      id: `meeting-notes-${meeting.id}`,
      kind: "summary",
      source: "meeting.notes",
      content: meeting.notes.trim()
    });
  }

  if (contextPack.length === 0 && options.missingPolicy.includes("阻塞")) {
    throw new Error("知识检索未命中任何上下文，已按缺失策略阻塞后续节点");
  }

  return {
    citations: meetingMemories.map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      content: memory.content.slice(0, 240),
      updatedAt: memory.updatedAt
    })),
    contextPack,
    documents: contextPack.length,
    embeddingModel: "none",
    missingPolicy: options.missingPolicy,
    notesReady: contextPack.length > 0,
    retrievalMode: "memory-store",
    sources: options.sources,
    topSimilarity: 0
  };
}

export async function retrieveMeetingKnowledge(
  meeting: MeetingRecord,
  options: KnowledgeRetrievalOptions = {}
): Promise<KnowledgeRetrievalResult> {
  const maxDocs = Math.max(1, options.maxDocs ?? 8);
  const sources = normalizeKnowledgeSources(options.sources);
  const missingPolicy = options.missingPolicy?.trim() || "continue";
  const query = buildRetrievalQuery(meeting, options.query);
  const embeddingModel = getEmbeddingProvider();

  const vectorHits = await searchVectorKnowledge({
    meetingId: meeting.id,
    query,
    topK: maxDocs
  });

  if (vectorHits.length > 0) {
    const contextPack = vectorHits.map((hit) => ({
      id: hit.id,
      kind: hit.kind,
      source:
        hit.sourceType === "meeting_notes"
          ? "meeting.notes"
          : hit.sourceType === "document"
            ? "knowledge.document"
            : "meeting.memory",
      content: hit.content,
      similarity: Number(hit.similarity.toFixed(4))
    }));

    return {
      citations: vectorHits.map((hit) => ({
        id: hit.id,
        kind: hit.kind as MeetingMemory["kind"] | "summary",
        content: hit.content.slice(0, 240),
        updatedAt: hit.updatedAt,
        similarity: Number(hit.similarity.toFixed(4))
      })),
      contextPack,
      documents: contextPack.length,
      embeddingModel,
      missingPolicy,
      notesReady: contextPack.length > 0,
      retrievalMode: retrievalModeFromProvider(embeddingModel),
      sources,
      topSimilarity: vectorHits[0]?.similarity ?? 0
    };
  }

  return retrieveWithMemoryStore(meeting, { maxDocs, missingPolicy, sources });
}

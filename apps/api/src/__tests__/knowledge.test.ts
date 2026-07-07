import { describe, it, expect } from "vitest";
import { seedMeetings } from "@meeting-flow/shared";
import { normalizeKnowledgeSources, retrieveMeetingKnowledge } from "../services/knowledgeRetrieval.js";

describe("Knowledge retrieval", () => {
  it("normalizes chinese source labels to machine-readable keys", () => {
    expect(normalizeKnowledgeSources("纪要库、CRM、项目文档")).toBe("meeting_memories,meeting_notes,knowledge_documents");
  });

  it("falls back to memory-store when vector index is empty", async () => {
    const meeting = {
      ...seedMeetings[0]!,
      notes: "会前背景：上季度 OKR 复盘尚未完成。"
    };

    const result = await retrieveMeetingKnowledge(meeting, {
      maxDocs: 4,
      sources: "meeting_memories,meeting_notes"
    });

    expect(["memory-store", "vector-local", "vector-openai"]).toContain(result.retrievalMode);
    expect(result.notesReady).toBe(true);
    expect(result.contextPack.some((item) => item.source === "meeting.notes")).toBe(true);
  });

  it("throws when missing policy blocks empty retrieval", async () => {
    const meeting = {
      ...seedMeetings[0]!,
      notes: ""
    };

    await expect(
      retrieveMeetingKnowledge(meeting, {
        missingPolicy: "生成待办并阻塞后续节点",
        maxDocs: 2,
        sources: "meeting_memories"
      })
    ).rejects.toThrow(/阻塞/);
  });
});

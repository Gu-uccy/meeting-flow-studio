import { describe, expect, it } from "vitest";
import { buildVectorChunkId, splitTextIntoChunks } from "../services/textChunking.js";

describe("textChunking", () => {
  it("keeps short text as a single chunk", () => {
    expect(splitTextIntoChunks("短文本记忆", { chunkSize: 120, chunkOverlap: 20 })).toEqual([
      { content: "短文本记忆", index: 0 }
    ]);
  });

  it("splits long text with overlap windows", () => {
    const longText = "A".repeat(300);
    const chunks = splitTextIntoChunks(longText, { chunkSize: 120, chunkOverlap: 30 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.content.length).toBeLessThanOrEqual(120);
    expect(chunks[1]?.content.startsWith("A")).toBe(true);
  });

  it("prefers paragraph boundaries before hard splitting", () => {
    const paragraph = "第一段内容比较长，包含 OKR 复盘细节。".repeat(4);
    const text = [paragraph, "第二段讨论客户反馈与阻塞项。".repeat(4), "第三段补充行动项。".repeat(4)].join("\n\n");
    const chunks = splitTextIntoChunks(text, { chunkSize: 70, chunkOverlap: 12 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.content.includes("OKR"))).toBe(true);
    expect(chunks.some((chunk) => chunk.content.includes("行动项"))).toBe(true);
  });

  it("builds stable chunk ids", () => {
    expect(buildVectorChunkId("memory-1", 0, 1)).toBe("vector-memory-1");
    expect(buildVectorChunkId("memory-1", 2, 4)).toBe("vector-memory-1--2");
  });
});

import { describe, expect, it } from "vitest";
import { detectKnowledgeFormat, isSupportedKnowledgeFile, readKnowledgeFile } from "./knowledgeFileUpload";

describe("knowledgeFileUpload", () => {
  it("detects markdown and text formats from extension", () => {
    expect(detectKnowledgeFormat("note.md")).toBe("markdown");
    expect(detectKnowledgeFormat("brief.MARKDOWN")).toBe("markdown");
    expect(detectKnowledgeFormat("notes.txt")).toBe("text");
    expect(detectKnowledgeFormat("data.csv")).toBe("text");
  });

  it("accepts common text files", () => {
    expect(isSupportedKnowledgeFile(new File(["hello"], "a.txt", { type: "text/plain" }))).toBe(true);
    expect(isSupportedKnowledgeFile(new File(["# hi"], "a.md", { type: "" }))).toBe(true);
    expect(isSupportedKnowledgeFile(new File(["%PDF"], "a.pdf", { type: "application/pdf" }))).toBe(false);
  });

  it("reads file content and title", async () => {
    const parsed = await readKnowledgeFile(new File(["会议纪要内容"], "客户背景.md", { type: "text/markdown" }));
    expect(parsed.title).toBe("客户背景");
    expect(parsed.format).toBe("markdown");
    expect(parsed.content).toBe("会议纪要内容");
  });

  it("rejects empty files", async () => {
    await expect(readKnowledgeFile(new File(["   "], "empty.txt", { type: "text/plain" }))).rejects.toThrow(/为空/);
  });
});

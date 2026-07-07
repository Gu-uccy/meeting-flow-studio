import { describe, it, expect } from "vitest";
import { previewNodeAgentPrompts, formatContextPackText } from "./promptPreview";
import type { AiApplicationPromptConfig, ProductWorkflowNode } from "@meeting-flow/shared";
import { seedMeetings } from "@meeting-flow/shared";

const promptConfig: AiApplicationPromptConfig = {
  systemPrompt: "你是 {{node.title}} 助手",
  userPrompt: "请处理会议 {{meeting.title}}，目标：{{meeting.meetingGoal}}",
  model: "claude-sonnet-4",
  temperature: 0.5,
  maxTokens: 1024
};

const node = {
  id: "agenda",
  title: "生成会议议程",
  kind: "ai"
} as ProductWorkflowNode;

describe("promptPreview", () => {
  it("renders meeting and node variables in prompt templates", () => {
    const meeting = seedMeetings[0]!;
    const preview = previewNodeAgentPrompts(promptConfig, node, meeting, {});

    expect(preview.systemPrompt).toContain("生成会议议程");
    expect(preview.userPrompt).toContain(meeting.title);
    expect(preview.userPrompt).toContain(meeting.meetingGoal);
    expect(preview.userPrompt).not.toContain("{{meeting.title}}");
  });

  it("injects vector retrieval context into prompt preview variables", () => {
    const meeting = seedMeetings[0]!;
    const contextPack = [
      {
        id: "memory-1",
        kind: "summary",
        source: "meeting.memory",
        content: "上季度 OKR 完成率 78%",
        similarity: 0.82
      }
    ];
    const contextPackText = formatContextPackText(contextPack);
    const preview = previewNodeAgentPrompts(
      {
        ...promptConfig,
        userPrompt: "请基于以下上下文回答：\n{{input.contextPackText}}"
      },
      node,
      meeting,
      {},
      {
        contextPack,
        retrievalMode: "vector-local",
        topSimilarity: 0.82
      }
    );

    expect(preview.userPrompt).toContain("OKR 完成率 78%");
    expect(preview.userPrompt).toContain(contextPackText);
    expect(preview.userPrompt).not.toContain("{{input.contextPackText}}");
  });
});

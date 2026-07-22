import { describe, expect, it } from "vitest";
import { getKnowledgeConfigFromNode } from "./knowledgeConfig";

describe("knowledgeConfig", () => {
  it("reads knowledge node config fields", () => {
    const config = getKnowledgeConfigFromNode({
      id: "context",
      kind: "knowledge",
      title: "加载上下文",
      description: "",
      position: { x: 0, y: 0 },
      owner: "知识检索",
      inputs: [],
      outputs: [],
      configFields: [
        { key: "sources", label: "数据源", value: "纪要库、CRM、项目文档", kind: "textarea" },
        { key: "missingPolicy", label: "缺失处理", value: "生成待办并阻塞后续节点", kind: "select" },
        { key: "maxDocs", label: "最大文档数", value: "6", kind: "text" }
      ]
    });

    expect(config.maxDocs).toBe(6);
    expect(config.sources).toBe("纪要库、CRM、项目文档");
    expect(config.missingPolicy).toBe("生成待办并阻塞后续节点");
  });
});

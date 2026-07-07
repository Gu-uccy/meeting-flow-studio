import { describe, it, expect } from "vitest";
import { createBlankWorkflowTemplate } from "../lib/templateFactory.js";
import { applyWorkflowTemplateVersion, buildWorkflowTemplateVersion } from "../lib/templateVersionFactory.js";

describe("templateVersionFactory", () => {
  it("builds and applies workflow template versions", () => {
    const template = createBlankWorkflowTemplate({ name: "版本工厂测试" });
    const version = buildWorkflowTemplateVersion(template, "snapshot", "测试快照", "测试用户");
    expect(version.version).toBe("v1");
    expect(version.nodes).toHaveLength(template.nodes.length);

    const modified = {
      ...template,
      nodes: template.nodes.map((node, index) => index === 0 ? { ...node, title: "已修改" } : node)
    };
    const restored = applyWorkflowTemplateVersion(modified, version);
    expect(restored.nodes[0]?.title).toBe(template.nodes[0]?.title);
  });
});

import { describe, expect, it } from "vitest";
import { createBlankWorkflowTemplate, cloneWorkflowTemplate } from "../lib/templateFactory.js";

describe("templateFactory", () => {
  it("creates blank template with trigger and ai nodes", () => {
    const template = createBlankWorkflowTemplate({ name: "空白模板" });
    expect(template.nodes).toHaveLength(2);
    expect(template.edges).toHaveLength(1);
    expect(template.status).toBe("draft");
  });

  it("clones template with remapped node ids", () => {
    const source = createBlankWorkflowTemplate({ name: "源模板" });
    const cloned = cloneWorkflowTemplate(source, "副本模板");
    expect(cloned.id).not.toBe(source.id);
    expect(cloned.name).toBe("副本模板");
    expect(cloned.nodes[0]?.id).not.toBe(source.nodes[0]?.id);
    expect(cloned.edges[0]?.source).toBe(cloned.nodes[0]?.id);
  });
});

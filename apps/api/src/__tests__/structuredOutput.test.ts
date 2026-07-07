import { describe, expect, it } from "vitest";
import {
  buildStructuredOutputSchemaPrompt,
  extractJsonObject,
  validateStructuredOutput
} from "../services/structuredOutput.js";

describe("structuredOutput", () => {
  it("builds schema prompt with required field keys", () => {
    const prompt = buildStructuredOutputSchemaPrompt([
      { key: "agendaDraft", label: "议程草案", type: "text", description: "会议议程" },
      { key: "riskCount", label: "风险数", type: "number", description: "" }
    ]);

    expect(prompt).toContain("agendaDraft");
    expect(prompt).toContain("riskCount");
    expect(prompt).toContain("JSON");
  });

  it("extracts json from fenced model output", () => {
    const parsed = extractJsonObject('说明如下\n```json\n{"agendaDraft":"议程 A"}\n```');
    expect(parsed).toEqual({ agendaDraft: "议程 A" });
  });

  it("validates structured output by schema", () => {
    const { output, errors } = validateStructuredOutput(
      [{ key: "routeDecision", label: "路由", type: "text", description: "" }],
      { routeDecision: "auto_approved" }
    );

    expect(errors).toEqual([]);
    expect(output.routeDecision).toBe("auto_approved");
  });
});

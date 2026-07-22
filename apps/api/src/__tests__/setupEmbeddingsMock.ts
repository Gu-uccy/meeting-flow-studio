import { vi } from "vitest";
import * as embeddings from "../services/embeddings.js";
import * as llm from "../services/llm.js";

vi.spyOn(embeddings, "isEmbeddingAvailable").mockReturnValue(true);
vi.spyOn(embeddings, "assertEmbeddingAvailable").mockImplementation(() => undefined);
vi.spyOn(embeddings, "getEmbeddingProvider").mockReturnValue("openai:text-embedding-3-small");
vi.spyOn(embeddings, "getEmbeddingDimensions").mockReturnValue(384);
vi.spyOn(embeddings, "embedTexts").mockImplementation(async (texts: string[]) =>
  texts.map((text) => embeddings.embedTextLocal(text))
);
vi.spyOn(embeddings, "embedText").mockImplementation(async (text: string) => embeddings.embedTextLocal(text));

/** Prevent real network LLM calls from hanging workflow/job tests. */
vi.spyOn(llm, "isLLMAvailable").mockReturnValue(true);
vi.spyOn(llm, "callLLM").mockImplementation(async (params) => ({
  content: `mock-llm:${params.model}`,
  model: params.model || "mock-model",
  inputTokens: 8,
  outputTokens: 16
}));
vi.spyOn(llm, "callLLMWithStructuredOutput").mockImplementation(async (params) => {
  const structuredOutput: Record<string, unknown> = {};
  for (const field of params.outputSchema) {
    structuredOutput[field.key] = field.type === "number" ? 1 : `mock-${field.key}`;
  }
  return {
    content: JSON.stringify(structuredOutput),
    model: params.model || "mock-model",
    inputTokens: 8,
    outputTokens: 16,
    structuredOutput
  };
});

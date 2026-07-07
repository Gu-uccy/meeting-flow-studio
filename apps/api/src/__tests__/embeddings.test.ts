import { describe, it, expect } from "vitest";
import { cosineSimilarity, embedTextLocal } from "../services/embeddings.js";

describe("embeddings", () => {
  it("returns normalized vectors with stable dimensions", () => {
    const vector = embedTextLocal("会议目标 OKR 复盘");
    expect(vector).toHaveLength(384);
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("ranks similar texts higher than unrelated texts", () => {
    const query = embedTextLocal("上季度 OKR 复盘进展");
    const related = embedTextLocal("本季度 OKR 复盘尚未完成，需要补充数据");
    const unrelated = embedTextLocal("今天天气不错，适合户外活动");
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
  });
});

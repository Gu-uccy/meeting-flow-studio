import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

export type KnowledgeIndexStats = {
  chunkCount: number;
  chunking: {
    chunkOverlap: number;
    chunkSize: number;
  };
  dimensions: number;
  embeddingModel: string;
};

type KnowledgeIndexResponse = {
  index: KnowledgeIndexStats;
  message?: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useKnowledgeIndex(isEnabled = true) {
  const [index, setIndex] = useState<KnowledgeIndexStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadIndex = useCallback(async () => {
    if (!isEnabled) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/knowledge/index");
      const data = (await response.json()) as Partial<KnowledgeIndexResponse> & { message?: string };

      if (!response.ok || !data.index) {
        throw new Error(data.message ?? "向量索引状态加载失败，请稍后重试。");
      }

      setIndex(data.index);
    } catch (requestError) {
      setError(parseErrorMessage("向量索引状态加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  async function rebuildIndex() {
    setIsRebuilding(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/knowledge/index/rebuild", { method: "POST" });
      const data = (await response.json()) as Partial<KnowledgeIndexResponse> & { message?: string };

      if (!response.ok || !data.index) {
        throw new Error(data.message ?? "向量索引重建失败，请稍后重试。");
      }

      setIndex(data.index);
      setFeedback(data.message ?? "向量索引已重建");
      return data.index;
    } catch (requestError) {
      setError(parseErrorMessage("向量索引重建失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsRebuilding(false);
    }
  }

  return {
    error,
    feedback,
    index,
    isLoading,
    isRebuilding,
    rebuildIndex,
    reloadIndex: loadIndex
  };
}

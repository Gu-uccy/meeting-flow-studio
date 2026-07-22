import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";
import type { KnowledgeRetrievalConfig } from "../lib/knowledgeConfig";
import type { PromptRetrievalContext } from "../lib/promptPreview";

type KnowledgeRetrieveResponse = {
  result?: PromptRetrievalContext & {
    citations: PromptRetrievalContext["citations"];
    contextPack: PromptRetrievalContext["contextPack"];
    embeddingModel: string;
    retrievalMode: string;
    topSimilarity: number;
  };
  message?: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useKnowledgeRetrieval(
  meetingId: string,
  enabled = true,
  query = "",
  options: KnowledgeRetrievalConfig = { maxDocs: 8 }
) {
  const [retrieval, setRetrieval] = useState<PromptRetrievalContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled || !meetingId) {
      setRetrieval(null);
      setError("");
      return null;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/knowledge/retrieve", {
        method: "POST",
        body: JSON.stringify({
          meetingId,
          maxDocs: options.maxDocs,
          missingPolicy: options.missingPolicy,
          query: query.trim() || undefined,
          sources: options.sources
        })
      });
      const data = (await response.json()) as KnowledgeRetrieveResponse;

      if (!response.ok || !data.result) {
        throw new Error(data.message ?? "向量检索上下文加载失败。");
      }

      const nextRetrieval: PromptRetrievalContext = {
        citations: data.result.citations,
        contextPack: data.result.contextPack,
        embeddingModel: data.result.embeddingModel,
        retrievalMode: data.result.retrievalMode,
        topSimilarity: data.result.topSimilarity
      };
      setRetrieval(nextRetrieval);
      return nextRetrieval;
    } catch (requestError) {
      setRetrieval(null);
      setError(parseErrorMessage("向量检索上下文加载失败。", requestError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, meetingId, options.maxDocs, options.missingPolicy, options.sources, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    error,
    isLoading,
    reload,
    retrieval
  };
}

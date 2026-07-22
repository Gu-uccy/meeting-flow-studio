import { useCallback, useState } from "react";
import { apiClient, readJson } from "../lib/apiClient";

export type KnowledgeSearchHit = {
  content: string;
  id: string;
  kind: string;
  similarity: number;
  sourceId: string;
  sourceType: "memory" | "meeting_notes";
  updatedAt: string;
};

type KnowledgeSearchResponse = {
  embeddingModel: string;
  items: KnowledgeSearchHit[];
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useKnowledgeSearch(meetingId: string, isEnabled = true) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KnowledgeSearchHit[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async (value?: string) => {
    const nextQuery = (value ?? query).trim();
    if (!isEnabled || !meetingId || !nextQuery) {
      setItems([]);
      return [];
    }

    setIsSearching(true);
    setError("");

    try {
      const searchParams = new URLSearchParams({
        meetingId,
        q: nextQuery,
        limit: "6"
      });
      const response = await apiClient(`/api/knowledge/search?${searchParams.toString()}`);
      const data = (await readJson(response)) as Partial<KnowledgeSearchResponse> & { message?: string };

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "向量检索失败，请稍后重试。");
      }

      setItems(data.items);
      setEmbeddingModel(data.embeddingModel ?? "");
      return data.items;
    } catch (requestError) {
      setError(parseErrorMessage("向量检索失败，请稍后重试。", requestError));
      setItems([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, [isEnabled, meetingId, query]);

  return {
    embeddingModel,
    error,
    isSearching,
    items,
    query,
    search,
    setQuery
  };
}

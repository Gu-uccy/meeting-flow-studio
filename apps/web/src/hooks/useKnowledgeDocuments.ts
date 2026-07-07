import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

export type KnowledgeDocument = {
  content: string;
  createdAt: string;
  format: "markdown" | "text";
  id: string;
  meetingId: string;
  ownerUserId: string;
  title: string;
  updatedAt: string;
};

type KnowledgeDocumentsResponse = {
  items: KnowledgeDocument[];
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useKnowledgeDocuments(meetingId: string, isEnabled = true) {
  const [items, setItems] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadDocuments = useCallback(async () => {
    if (!isEnabled || !meetingId) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient(`/api/knowledge/documents?meetingId=${encodeURIComponent(meetingId)}`);
      const data = (await response.json()) as Partial<KnowledgeDocumentsResponse> & { message?: string };

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "知识文档加载失败，请稍后重试。");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(parseErrorMessage("知识文档加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, meetingId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadDocument(title: string, content: string, format: "markdown" | "text" = "text") {
    if (!meetingId) {
      return null;
    }

    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/knowledge/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, title, content, format })
      });
      const data = (await response.json()) as { document?: KnowledgeDocument; message?: string };

      if (!response.ok || !data.document) {
        throw new Error(data.message ?? "知识文档上传失败，请稍后重试。");
      }

      setItems((current) => [data.document as KnowledgeDocument, ...current]);
      setFeedback(data.message ?? "知识文档已上传");
      return data.document;
    } catch (requestError) {
      setError(parseErrorMessage("知识文档上传失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteDocument(documentId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/knowledge/documents/${documentId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "知识文档删除失败，请稍后重试。");
      }

      setItems((current) => current.filter((item) => item.id !== documentId));
      setFeedback(data.message ?? "知识文档已删除");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("知识文档删除失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    deleteDocument,
    error,
    feedback,
    isLoading,
    isMutating,
    items,
    reloadDocuments: loadDocuments,
    uploadDocument
  };
}

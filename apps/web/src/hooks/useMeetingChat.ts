import { useCallback, useEffect, useState } from "react";
import type { MeetingChatMessage } from "@meeting-flow/shared";
import { apiClient, readJson } from "../lib/apiClient";

type ChatMessagesResponse = {
  items: MeetingChatMessage[];
  message?: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useMeetingChat(isEnabled = true, meetingId = "") {
  const [items, setItems] = useState<MeetingChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    if (!isEnabled || !meetingId) {
      setItems([]);
      setIsLoading(false);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient(`/api/meetings/${meetingId}/chat/messages`);
      const data = (await readJson(response)) as Partial<ChatMessagesResponse> & { message?: string };

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "对话加载失败，请稍后重试。");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(parseErrorMessage("对话加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, meetingId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const sendMessage = useCallback(async (content?: string) => {
    const message = (content ?? draft).trim();
    if (!isEnabled || !meetingId || !message || isSending) {
      return null;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await apiClient(`/api/meetings/${meetingId}/chat/messages`, {
        method: "POST",
        body: JSON.stringify({ content: message })
      });
      const data = (await readJson(response)) as Partial<ChatMessagesResponse> & { message?: string };

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "发送失败，请稍后重试。");
      }

      const newItems = data.items;
      setItems((current) => [...current, ...newItems]);
      setDraft("");
      return newItems;
    } catch (requestError) {
      setError(parseErrorMessage("发送失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsSending(false);
    }
  }, [draft, isEnabled, isSending, meetingId]);

  const clearMessages = useCallback(async () => {
    if (!isEnabled || !meetingId || isSending) {
      return false;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await apiClient(`/api/meetings/${meetingId}/chat/messages`, {
        method: "DELETE"
      });
      const data = (await readJson(response)) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "清空对话失败，请稍后重试。");
      }

      setItems([]);
      setDraft("");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("清空对话失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsSending(false);
    }
  }, [isEnabled, isSending, meetingId]);

  return {
    clearMessages,
    draft,
    error,
    isLoading,
    isSending,
    items,
    loadMessages,
    sendMessage,
    setDraft
  };
}

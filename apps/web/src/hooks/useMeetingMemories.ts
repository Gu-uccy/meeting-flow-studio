import { useCallback, useEffect, useState } from "react";
import type { MeetingMemory } from "@meeting-flow/shared";
import { apiClient } from "../lib/apiClient";

type MeetingMemoriesResponse = {
  items: MeetingMemory[];
};

type MeetingMemoryMutationResponse = {
  memory: MeetingMemory;
  message: string;
};

type MeetingMemoryPatch = Partial<Pick<MeetingMemory, "content" | "kind" | "visibility" | "isPinned">>;

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

function sortMemories(left: MeetingMemory, right: MeetingMemory) {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function useMeetingMemories(isEnabled = true, meetingId = "") {
  const [items, setItems] = useState<MeetingMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");

  const loadMemories = useCallback(async () => {
    if (!isEnabled || !meetingId) {
      setItems([]);
      setIsLoading(false);
      setError("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const searchParams = new URLSearchParams({
        meetingId,
        limit: "8"
      });
      const response = await apiClient(`/api/memories?${searchParams.toString()}`);
      const data = (await response.json()) as Partial<MeetingMemoriesResponse> & { message?: string };

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "会议记忆加载失败，请稍后重试。");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(parseErrorMessage("会议记忆加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, meetingId]);

  const updateMemory = useCallback(async (memoryId: string, patch: MeetingMemoryPatch) => {
    setIsMutating(true);
    setError("");

    try {
      const response = await apiClient(`/api/memories/${memoryId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      const data = (await response.json()) as Partial<MeetingMemoryMutationResponse> & { message?: string };

      if (!response.ok || !data.memory) {
        throw new Error(data.message ?? "会议记忆更新失败，请稍后重试。");
      }

      setItems((currentItems) =>
        currentItems.map((item) => (item.id === data.memory?.id ? data.memory : item)).sort(sortMemories)
      );
      return data.memory;
    } catch (requestError) {
      setError(parseErrorMessage("会议记忆更新失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const deleteMemory = useCallback(async (memoryId: string) => {
    setIsMutating(true);
    setError("");

    try {
      const response = await apiClient(`/api/memories/${memoryId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "会议记忆删除失败，请稍后重试。");
      }

      setItems((currentItems) => currentItems.filter((item) => item.id !== memoryId));
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("会议记忆删除失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  return {
    deleteMemory,
    error,
    isLoading,
    isMutating,
    items,
    reloadMemories: loadMemories,
    updateMemory
  };
}

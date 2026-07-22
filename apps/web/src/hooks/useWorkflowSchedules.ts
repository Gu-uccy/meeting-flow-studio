import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

export type WorkflowScheduleExecution = {
  runId: string;
  status: string;
  triggeredAt: string;
};

export type WorkflowSchedule = {
  cronExpression: string;
  enabled: boolean;
  executionHistory?: WorkflowScheduleExecution[];
  id: string;
  lastRunId?: string;
  lastTriggeredAt?: string;
  meetingId?: string;
  templateId: string;
};

type WorkflowSchedulesResponse = {
  items: WorkflowSchedule[];
};

type WorkflowScheduleMutationResponse = {
  message: string;
  schedule: WorkflowSchedule;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useWorkflowSchedules(isEnabled = true) {
  const [items, setItems] = useState<WorkflowSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadSchedules = useCallback(async () => {
    if (!isEnabled) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/workflows/schedules");
      const data = (await response.json()) as Partial<WorkflowSchedulesResponse> & { message?: string };

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.message ?? "定时任务加载失败，请稍后重试。");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(parseErrorMessage("定时任务加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  async function createSchedule(templateId: string, cronExpression: string, meetingId?: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/workflows/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, cronExpression, meetingId })
      });
      const data = (await response.json()) as Partial<WorkflowScheduleMutationResponse> & { message?: string };

      if (!response.ok || !data.schedule) {
        throw new Error(data.message ?? "创建定时任务失败，请稍后重试。");
      }

      setItems((current) => [...current, data.schedule as WorkflowSchedule]);
      setFeedback(data.message ?? "计划任务已创建");
      return data.schedule;
    } catch (requestError) {
      setError(parseErrorMessage("创建定时任务失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateSchedule(
    id: string,
    patch: Partial<Pick<WorkflowSchedule, "enabled" | "meetingId" | "cronExpression">>
  ) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = (await response.json()) as Partial<WorkflowScheduleMutationResponse> & { message?: string };

      if (!response.ok || !data.schedule) {
        throw new Error(data.message ?? "更新定时任务失败，请稍后重试。");
      }

      setItems((current) => current.map((item) => (item.id === id ? (data.schedule as WorkflowSchedule) : item)));
      setFeedback(data.message ?? "计划任务已更新");
      return data.schedule;
    } catch (requestError) {
      setError(parseErrorMessage("更新定时任务失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteSchedule(id: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/schedules/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "删除定时任务失败，请稍后重试。");
      }

      setItems((current) => current.filter((item) => item.id !== id));
      setFeedback(data.message ?? "计划任务已删除");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("删除定时任务失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    createSchedule,
    deleteSchedule,
    error,
    feedback,
    isLoading,
    isMutating,
    items,
    reloadSchedules: loadSchedules,
    updateSchedule
  };
}

import { useCallback, useEffect, useState } from "react";
import type { AuditLogEntry } from "@meeting-flow/shared";
import { apiClient, readJson } from "../lib/apiClient";

type AuditLogsResponse = {
  items: AuditLogEntry[];
};

export function useAuditLogs(meetingId?: string, enabled = true) {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();
      if (meetingId) {
        query.set("meetingId", meetingId);
      }
      query.set("limit", "50");

      const response = await apiClient(`/api/audit-logs?${query.toString()}`);
      const data = (await readJson(response)) as AuditLogsResponse & { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "操作记录加载失败");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "操作记录加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, meetingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    isLoading,
    error,
    reload
  };
}

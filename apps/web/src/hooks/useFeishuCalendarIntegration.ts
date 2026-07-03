import { useEffect, useRef, useState } from "react";
import type { MeetingDashboardSummary, MeetingRecordWithPermissions } from "@meeting-flow/shared";
import { apiClient } from "../lib/apiClient";

type FeishuIntegrationStatus = {
  provider: "feishu";
  isConfigured: boolean;
  isConnected: boolean;
  redirectUri: string;
  calendarId: string;
  message: string;
};

type MeetingMutationResponse = {
  meeting: MeetingRecordWithPermissions;
  summary: MeetingDashboardSummary;
  message: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useFeishuCalendarIntegration(
  isEnabled = true,
  onMeetingSynced?: (meeting: MeetingRecordWithPermissions, summary: MeetingDashboardSummary) => void
) {
  const [status, setStatus] = useState<FeishuIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const statusPollTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      setStatus(null);
      setFeedback("");
      setError("");
      setIsLoading(false);
      return;
    }

    void loadStatus();
  }, [isEnabled]);

  useEffect(() => () => {
    if (statusPollTimer.current !== null) {
      window.clearInterval(statusPollTimer.current);
    }
  }, []);

  async function loadStatus() {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/integrations/feishu/status");
      const data = (await response.json()) as FeishuIntegrationStatus;

      if (!response.ok) {
        throw new Error(data.message ?? "飞书日历状态加载失败");
      }

      setStatus(data);
      return data;
    } catch (requestError) {
      setError(parseErrorMessage("飞书日历状态加载失败", requestError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  function startStatusPolling() {
    if (statusPollTimer.current !== null) {
      window.clearInterval(statusPollTimer.current);
    }

    let attempts = 0;
    statusPollTimer.current = window.setInterval(() => {
      attempts += 1;
      void loadStatus().then((latestStatus) => {
        if (latestStatus?.isConnected || attempts >= 20) {
          if (statusPollTimer.current !== null) {
            window.clearInterval(statusPollTimer.current);
            statusPollTimer.current = null;
          }
        }
      });
    }, 3000);
  }

  async function connectFeishuCalendar() {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/integrations/feishu/auth-url");
      const data = (await response.json()) as { authUrl?: string; message?: string; redirectUri?: string };

      if (!response.ok || !data.authUrl) {
        throw new Error(data.message ?? "飞书授权地址获取失败");
      }

      window.open(data.authUrl, "_blank", "noopener,noreferrer,width=720,height=760");
      startStatusPolling();
      setFeedback("已打开飞书授权窗口，授权完成后回到这里同步会议。");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("飞书授权地址获取失败", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function syncMeeting(meetingId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/meetings/${meetingId}/sync-feishu-calendar`, {
        method: "POST"
      });
      const data = (await response.json()) as Partial<MeetingMutationResponse> & { message?: string };

      if (!response.ok || !data.meeting || !data.summary) {
        throw new Error(data.message ?? "飞书日历同步失败");
      }

      onMeetingSynced?.(data.meeting, data.summary);
      setFeedback(data.message ?? "已同步到飞书日历");
      return data.meeting;
    } catch (requestError) {
      setError(parseErrorMessage("飞书日历同步失败", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    connectFeishuCalendar,
    error,
    feedback,
    isConnected: Boolean(status?.isConnected),
    isConfigured: Boolean(status?.isConfigured),
    isLoading,
    isMutating,
    redirectUri: status?.redirectUri ?? "",
    reloadStatus: loadStatus,
    statusMessage: status?.message ?? "",
    syncMeeting
  };
}

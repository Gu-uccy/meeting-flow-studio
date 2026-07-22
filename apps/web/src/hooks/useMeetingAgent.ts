import { useCallback, useEffect, useState } from "react";
import type { MeetingAgentRun, ProductWorkflowRun } from "@meeting-flow/shared";
import { apiClient, readJson } from "../lib/apiClient";

type MeetingAgentResponse = {
  agentRun: MeetingAgentRun;
  workflowRun: ProductWorkflowRun;
  memoryCount: number;
  message: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useMeetingAgent(isEnabled = true, meetingId = "") {
  const [agentRun, setAgentRun] = useState<MeetingAgentRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEnabled || !meetingId) {
      setAgentRun(null);
      setIsRunning(false);
      setError("");
    }
  }, [isEnabled, meetingId]);

  const runAgent = useCallback(async () => {
    if (!isEnabled || !meetingId) {
      return null;
    }

    setIsRunning(true);
    setError("");

    try {
      const response = await apiClient(`/api/agent/meetings/${meetingId}/run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const data = (await readJson(response)) as Partial<MeetingAgentResponse> & { message?: string };

      if (!response.ok || !data.agentRun) {
        throw new Error(data.message ?? "Agent 分析失败，请稍后重试。");
      }

      setAgentRun(data.agentRun);
      return data.agentRun;
    } catch (requestError) {
      setError(parseErrorMessage("Agent 分析失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [isEnabled, meetingId]);

  return {
    agentRun,
    error,
    isRunning,
    runAgent
  };
}

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

export type AiSettings = {
  provider: "anthropic";
  isUserConfigured: boolean;
  isEnvironmentConfigured: boolean;
  keySource: "user" | "environment" | "none";
  keyHint: string;
  updatedAt: string;
};

type AiSettingsResponse = {
  settings: AiSettings;
  message?: string;
};

const emptySettings: AiSettings = {
  provider: "anthropic",
  isUserConfigured: false,
  isEnvironmentConfigured: false,
  keySource: "none",
  keyHint: "",
  updatedAt: ""
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useAiSettings(isEnabled = true) {
  const [settings, setSettings] = useState<AiSettings>(emptySettings);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    if (!isEnabled) {
      setSettings(emptySettings);
      setApiKeyDraft("");
      setError("");
      setFeedback("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/ai/settings");
      const data = (await response.json()) as Partial<AiSettingsResponse> & { message?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.message ?? "AI 设置加载失败，请稍后重试。");
      }

      setSettings(data.settings);
    } catch (requestError) {
      setError(parseErrorMessage("AI 设置加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  const saveApiKey = useCallback(async () => {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/ai/settings", {
        method: "PUT",
        body: JSON.stringify({ apiKey: apiKeyDraft })
      });
      const data = (await response.json()) as Partial<AiSettingsResponse> & { message?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.message ?? "AI API Key 保存失败，请检查后重试。");
      }

      setSettings(data.settings);
      setApiKeyDraft("");
      setFeedback(data.message ?? "AI API Key 已保存。");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("AI API Key 保存失败，请检查后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [apiKeyDraft]);

  const deleteApiKey = useCallback(async () => {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/ai/settings", {
        method: "DELETE"
      });
      const data = (await response.json()) as Partial<AiSettingsResponse> & { message?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.message ?? "AI API Key 删除失败，请稍后重试。");
      }

      setSettings(data.settings);
      setApiKeyDraft("");
      setFeedback(data.message ?? "AI API Key 已删除。");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("AI API Key 删除失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return {
    apiKeyDraft,
    deleteApiKey,
    error,
    feedback,
    isLoading,
    isMutating,
    reloadSettings: loadSettings,
    saveApiKey,
    setApiKeyDraft,
    settings
  };
}

import { useCallback, useEffect, useState } from "react";
import { apiClient, readJson } from "../lib/apiClient";

export type AiSettings = {
  provider: "openai-compatible";
  isUserConfigured: boolean;
  isEnvironmentConfigured: boolean;
  keySource: "user" | "environment" | "none";
  keyHint: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
  updatedAt: string;
};

type AiSettingsResponse = {
  settings: AiSettings;
  message?: string;
};

const emptySettings: AiSettings = {
  provider: "openai-compatible",
  isUserConfigured: false,
  isEnvironmentConfigured: false,
  keySource: "none",
  keyHint: "",
  baseUrl: "https://api.openai.com/v1",
  chatModel: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  updatedAt: ""
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useAiSettings(isEnabled = true) {
  const [settings, setSettings] = useState<AiSettings>(emptySettings);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [baseUrlDraft, setBaseUrlDraft] = useState(emptySettings.baseUrl);
  const [chatModelDraft, setChatModelDraft] = useState(emptySettings.chatModel);
  const [embeddingModelDraft, setEmbeddingModelDraft] = useState(emptySettings.embeddingModel);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    if (!isEnabled) {
      setSettings(emptySettings);
      setApiKeyDraft("");
      setBaseUrlDraft(emptySettings.baseUrl);
      setChatModelDraft(emptySettings.chatModel);
      setEmbeddingModelDraft(emptySettings.embeddingModel);
      setError("");
      setFeedback("");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/ai/settings");
      const data = (await readJson(response)) as Partial<AiSettingsResponse> & { message?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.message ?? "AI 设置加载失败，请稍后重试。");
      }

      setSettings(data.settings);
      setBaseUrlDraft(data.settings.baseUrl || emptySettings.baseUrl);
      setChatModelDraft(data.settings.chatModel || emptySettings.chatModel);
      setEmbeddingModelDraft(data.settings.embeddingModel || emptySettings.embeddingModel);
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
        body: JSON.stringify({
          apiKey: apiKeyDraft,
          baseUrl: baseUrlDraft,
          chatModel: chatModelDraft,
          embeddingModel: embeddingModelDraft
        })
      });
      const data = (await readJson(response)) as Partial<AiSettingsResponse> & { message?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.message ?? "AI 服务配置保存失败，请检查后重试。");
      }

      setSettings(data.settings);
      setApiKeyDraft("");
      setBaseUrlDraft(data.settings.baseUrl || emptySettings.baseUrl);
      setChatModelDraft(data.settings.chatModel || emptySettings.chatModel);
      setEmbeddingModelDraft(data.settings.embeddingModel || emptySettings.embeddingModel);
      setFeedback(data.message ?? "AI 服务配置已保存。");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("AI 服务配置保存失败，请检查后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [apiKeyDraft, baseUrlDraft, chatModelDraft, embeddingModelDraft]);

  const deleteApiKey = useCallback(async () => {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/ai/settings", {
        method: "DELETE"
      });
      const data = (await readJson(response)) as Partial<AiSettingsResponse> & { message?: string };

      if (!response.ok || !data.settings) {
        throw new Error(data.message ?? "AI 服务配置删除失败，请稍后重试。");
      }

      setSettings(data.settings);
      setApiKeyDraft("");
      setBaseUrlDraft(data.settings.baseUrl || emptySettings.baseUrl);
      setChatModelDraft(data.settings.chatModel || emptySettings.chatModel);
      setEmbeddingModelDraft(data.settings.embeddingModel || emptySettings.embeddingModel);
      setFeedback(data.message ?? "AI 服务配置已删除。");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("AI 服务配置删除失败，请稍后重试。", requestError));
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
    baseUrlDraft,
    chatModelDraft,
    deleteApiKey,
    embeddingModelDraft,
    error,
    feedback,
    isLoading,
    isMutating,
    reloadSettings: loadSettings,
    saveApiKey,
    setApiKeyDraft,
    setBaseUrlDraft,
    setChatModelDraft,
    setEmbeddingModelDraft,
    settings
  };
}

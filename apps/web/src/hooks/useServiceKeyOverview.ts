import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiApplication } from "@meeting-flow/shared";
import { apiClient } from "../lib/apiClient";
import type { ServiceKeyRecord } from "./useServiceApiKeys";

type ServiceKeyListResponse = {
  items: ServiceKeyRecord[];
  message?: string;
};

type ServiceKeyCreateResponse = {
  key: string;
  serviceKey: ServiceKeyRecord;
  message?: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

export function useServiceKeyOverview(applications: AiApplication[], isEnabled = true) {
  const applicationIds = useMemo(
    () => applications.map((item) => item.id).join(","),
    [applications]
  );

  const [keysByApplicationId, setKeysByApplicationId] = useState<Record<string, ServiceKeyRecord[]>>({});
  const [createdKeysByApplicationId, setCreatedKeysByApplicationId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadAll = useCallback(async () => {
    if (!isEnabled || applications.length === 0) {
      setKeysByApplicationId({});
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const entries = await Promise.all(
        applications.map(async (application) => {
          const response = await apiClient(`/api/apps/${application.id}/service-keys`);
          const data = (await response.json()) as Partial<ServiceKeyListResponse> & { message?: string };

          if (!response.ok || !data.items) {
            throw new Error(data.message ?? `加载 ${application.name} 的 Service Key 失败`);
          }

          return [application.id, data.items] as const;
        })
      );

      setKeysByApplicationId(Object.fromEntries(entries));
    } catch (requestError) {
      setError(parseErrorMessage("Service API Key 加载失败", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [applicationIds, applications, isEnabled]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totalCount = useMemo(
    () => Object.values(keysByApplicationId).reduce((sum, items) => sum + items.length, 0),
    [keysByApplicationId]
  );

  async function createKey(applicationId: string, label?: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/service-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label })
      });
      const data = (await response.json()) as Partial<ServiceKeyCreateResponse> & { message?: string };

      if (!response.ok || !data.serviceKey || !data.key) {
        throw new Error(data.message ?? "Service API Key 创建失败");
      }

      setKeysByApplicationId((current) => ({
        ...current,
        [applicationId]: [data.serviceKey as ServiceKeyRecord, ...(current[applicationId] ?? [])]
      }));
      setCreatedKeysByApplicationId((current) => ({
        ...current,
        [applicationId]: data.key as string
      }));
      setFeedback(data.message ?? "Service API Key 已创建");
      return data.key;
    } catch (requestError) {
      setError(parseErrorMessage("Service API Key 创建失败", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteKey(applicationId: string, keyId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/service-keys/${keyId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Service API Key 删除失败");
      }

      setKeysByApplicationId((current) => ({
        ...current,
        [applicationId]: (current[applicationId] ?? []).filter((item) => item.id !== keyId)
      }));
      setFeedback(data.message ?? "Service API Key 已删除");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("Service API Key 删除失败", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    createKey,
    createdKeysByApplicationId,
    deleteKey,
    error,
    feedback,
    isLoading,
    isMutating,
    keysByApplicationId,
    reloadAll: loadAll,
    totalCount
  };
}

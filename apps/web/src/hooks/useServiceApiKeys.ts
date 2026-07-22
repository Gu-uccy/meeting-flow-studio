import { useCallback, useEffect, useState } from "react";
import { apiClient, readJson } from "../lib/apiClient";

export type ServiceKeyRecord = {
  applicationId: string;
  createdAt: string;
  id: string;
  keyHint: string;
  label: string;
  userId?: string;
};

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

export function useServiceApiKeys(applicationId: string, isEnabled = true) {
  const [items, setItems] = useState<ServiceKeyRecord[]>([]);
  const [createdKey, setCreatedKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadKeys = useCallback(async () => {
    if (!isEnabled || !applicationId) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/service-keys`);
      const data = (await readJson(response)) as Partial<ServiceKeyListResponse> & { message?: string };

      if (!response.ok || !data.items) {
        throw new Error(data.message ?? "Service API Key 加载失败");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(parseErrorMessage("Service API Key 加载失败", requestError));
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, isEnabled]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey(label?: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");
    setCreatedKey("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/service-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label })
      });
      const data = (await readJson(response)) as Partial<ServiceKeyCreateResponse> & { message?: string };

      if (!response.ok || !data.serviceKey || !data.key) {
        throw new Error(data.message ?? "Service API Key 创建失败");
      }

      setItems((current) => [data.serviceKey as ServiceKeyRecord, ...current]);
      setCreatedKey(data.key);
      setFeedback(data.message ?? "Service API Key 已创建");
      return data.key;
    } catch (requestError) {
      setError(parseErrorMessage("Service API Key 创建失败", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteKey(keyId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/service-keys/${keyId}`, {
        method: "DELETE"
      });
      const data = (await readJson(response)) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "Service API Key 删除失败");
      }

      setItems((current) => current.filter((item) => item.id !== keyId));
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
    createdKey,
    deleteKey,
    error,
    feedback,
    isLoading,
    isMutating,
    items,
    reloadKeys: loadKeys
  };
}

import { useCallback, useEffect, useState } from "react";
import type { PublicUser, Workspace } from "@meeting-flow/shared";
import { DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID } from "@meeting-flow/shared";
import { apiClient, readJson } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";

type WorkspacesResponse = {
  items: Workspace[];
  activeWorkspaceId: string;
};

type CreateWorkspaceResponse = {
  workspace: Workspace;
  user: PublicUser;
  token: string;
  message: string;
};

const SEED_WORKSPACE_IDS = new Set([DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID]);

export function useWorkspace(enabled = true) {
  const { user, switchWorkspace, applySession } = useAuth();
  const [items, setItems] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled || !user) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient("/api/workspaces");
      const data = (await readJson(response)) as WorkspacesResponse;

      if (!response.ok) {
        throw new Error((data as { message?: string }).message ?? "工作区列表加载失败");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "工作区列表加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  useEffect(() => {
    void reload();
  }, [reload, user?.workspaceId]);

  const activeWorkspace = items.find((workspace) => workspace.id === user?.workspaceId) ?? null;

  const changeWorkspace = useCallback(async (workspaceId: string) => {
    if (!user || workspaceId === user.workspaceId) {
      return true;
    }

    setIsSwitching(true);
    setError("");

    try {
      const success = await switchWorkspace(workspaceId);
      if (!success) {
        setError("切换工作区失败");
      }
      return success;
    } finally {
      setIsSwitching(false);
    }
  }, [switchWorkspace, user]);

  const createWorkspace = useCallback(async (name: string) => {
    setIsCreating(true);
    setError("");

    try {
      const response = await apiClient("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      const data = (await readJson(response)) as CreateWorkspaceResponse & { message?: string };

      if (!response.ok || !data.workspace || !data.token) {
        throw new Error(data.message ?? "创建工作区失败");
      }

      applySession(data.user, data.token);
      await reload();
      return data.workspace;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "创建工作区失败";
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [applySession, reload]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    setIsUpdating(true);
    setError("");

    try {
      const response = await apiClient(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      const data = (await readJson(response)) as { workspace?: Workspace; message?: string };
      if (!response.ok || !data.workspace) {
        throw new Error(data.message ?? "重命名工作区失败");
      }
      await reload();
      return data.workspace;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "重命名工作区失败");
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [reload]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    setIsUpdating(true);
    setError("");

    try {
      const response = await apiClient(`/api/workspaces/${workspaceId}`, {
        method: "DELETE"
      });
      const data = (await readJson(response)) as {
        message?: string;
        user?: PublicUser;
        token?: string;
      };
      if (!response.ok) {
        throw new Error(data.message ?? "删除工作区失败");
      }
      if (data.user && data.token) {
        applySession(data.user, data.token);
      }
      await reload();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "删除工作区失败");
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [applySession, reload]);

  return {
    items,
    activeWorkspace,
    isLoading,
    isSwitching,
    isCreating,
    isUpdating,
    error,
    canSwitch: items.length > 1,
    canDeleteWorkspace: (workspaceId: string) => !SEED_WORKSPACE_IDS.has(workspaceId),
    reload,
    switchWorkspace: changeWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace
  };
}

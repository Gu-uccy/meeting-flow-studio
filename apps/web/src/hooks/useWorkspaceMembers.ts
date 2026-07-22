import { useCallback, useEffect, useState } from "react";
import type { WorkspaceMember, WorkspaceMemberRole } from "@meeting-flow/shared";
import { apiClient, readJson } from "../lib/apiClient";

type MembersResponse = {
  items: WorkspaceMember[];
};

type InviteResponse = {
  member: WorkspaceMember;
  message: string;
};

type UpdateRoleResponse = {
  member: WorkspaceMember;
  message: string;
};

export function useWorkspaceMembers(workspaceId: string | null, enabled = true) {
  const [items, setItems] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [isRemovingId, setIsRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!enabled || !workspaceId) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiClient(`/api/workspaces/${workspaceId}/members`);
      const data = (await readJson(response)) as MembersResponse & { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "成员列表加载失败");
      }

      setItems(data.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "成员列表加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const inviteMember = useCallback(async (email: string, role: WorkspaceMemberRole = "editor") => {
    if (!workspaceId) {
      return null;
    }

    setIsInviting(true);
    setError("");

    try {
      const response = await apiClient(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role })
      });
      const data = (await readJson(response)) as InviteResponse & { message?: string };

      if (!response.ok || !data.member) {
        throw new Error(data.message ?? "邀请成员失败");
      }

      setItems((current) => {
        const exists = current.some((member) => member.id === data.member.id);
        if (exists) {
          return current;
        }
        return [...current, data.member].sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
      });
      return data.member;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "邀请成员失败";
      setError(message);
      return null;
    } finally {
      setIsInviting(false);
    }
  }, [workspaceId]);

  const updateMemberRole = useCallback(async (userId: string, role: WorkspaceMemberRole) => {
    if (!workspaceId) {
      return null;
    }

    setIsUpdatingId(userId);
    setError("");

    try {
      const response = await apiClient(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      const data = (await readJson(response)) as UpdateRoleResponse & { message?: string };

      if (!response.ok || !data.member) {
        throw new Error(data.message ?? "更新成员角色失败");
      }

      setItems((current) =>
        current
          .map((member) => (member.id === data.member.id ? data.member : member))
          .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
      );
      return data.member;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "更新成员角色失败";
      setError(message);
      return null;
    } finally {
      setIsUpdatingId(null);
    }
  }, [workspaceId]);

  const removeMember = useCallback(async (userId: string) => {
    if (!workspaceId) {
      return false;
    }

    setIsRemovingId(userId);
    setError("");

    try {
      const response = await apiClient(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "DELETE"
      });
      const data = (await readJson(response)) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "移除成员失败");
      }

      setItems((current) => current.filter((member) => member.id !== userId));
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "移除成员失败";
      setError(message);
      return false;
    } finally {
      setIsRemovingId(null);
    }
  }, [workspaceId]);

  return {
    items,
    isLoading,
    isInviting,
    isUpdatingId,
    isRemovingId,
    error,
    reload,
    inviteMember,
    updateMemberRole,
    removeMember
  };
}

import { useState, type FormEvent } from "react";
import type { Workspace, WorkspaceMemberRole } from "@meeting-flow/shared";
import { useAuth } from "../../../contexts/AuthContext";
import { useWorkspaceMembers } from "../../../hooks/useWorkspaceMembers";
import { Dropdown } from "../../common/Dropdown";
import { Modal } from "../../common/Modal";
import { SelectableCardList } from "../../common/SelectableCardList";
import { canManageWorkspaceMembers, getWorkspaceProductRole } from "./navAccess";

const roleLabels: Record<WorkspaceMemberRole, string> = {
  admin: "管理员",
  editor: "编辑者",
  viewer: "观察者"
};

const roleOptions = (Object.keys(roleLabels) as WorkspaceMemberRole[]).map((value) => ({
  label: roleLabels[value],
  value
}));

type WorkspaceMembersModalProps = {
  workspace: Workspace;
  onClose: () => void;
};

export function WorkspaceMembersModal({ workspace, onClose }: WorkspaceMembersModalProps) {
  const { user } = useAuth();
  const workspaceRole = user ? getWorkspaceProductRole(user, workspace.id) : "viewer";
  const canManage = canManageWorkspaceMembers(workspaceRole);

  const {
    items,
    isLoading,
    isInviting,
    isUpdatingId,
    isRemovingId,
    error,
    inviteMember,
    updateMemberRole,
    removeMember
  } = useWorkspaceMembers(workspace.id);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>("editor");

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !canManage) {
      return;
    }

    const member = await inviteMember(normalizedEmail, inviteRole);
    if (member) {
      setEmail("");
      setInviteRole("editor");
    }
  }

  return (
    <Modal onClose={onClose} size="md" title={`${workspace.name} · 成员`}>
      <div className="workspace-members">
        {canManage ? (
          <form className="workspace-members__invite" onSubmit={handleInvite}>
            <label className="workspace-members__field">
              <span>邀请成员（邮箱）</span>
              <input
                autoFocus
                onChange={(event) => setEmail(event.target.value)}
                placeholder="member@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="workspace-members__field">
              <span>工作区角色</span>
              <Dropdown
                ariaLabel="邀请角色"
                onChange={(value) => setInviteRole(value as WorkspaceMemberRole)}
                options={roleOptions}
                value={inviteRole}
              />
            </label>
            <button className="primary-button" disabled={isInviting || !email.trim()} type="submit">
              {isInviting ? "邀请中…" : "发送邀请"}
            </button>
          </form>
        ) : (
          <p className="workspace-members__hint">仅工作区管理员可邀请或调整成员角色。</p>
        )}

        <p className="workspace-members__hint">
          成员角色仅作用于本工作区；平台角色（账号设置中）仍用于跨工作区能力。
        </p>

        {error ? <p className="workspace-members__error">{error}</p> : null}

        <div className="workspace-members__list">
          <SelectableCardList
            ariaLabel="工作区成员"
            empty={
              <p className="workspace-members__placeholder">
                {isLoading ? "加载成员…" : "暂无成员"}
              </p>
            }
            items={items.map((member) => {
              const memberRole = member.memberRole ?? member.role;
              return {
                id: member.id,
                title: member.name,
                badge: member.isActive ? "当前活跃" : undefined,
                badgeClassName: member.isActive ? "workspace-members__badge" : undefined,
                meta: `${member.email} · ${roleLabels[memberRole] ?? memberRole}`,
                actions:
                  member.id === user?.id ? (
                    <span className="workspace-members__self">本人</span>
                  ) : canManage ? (
                    <div className="workspace-members__actions">
                      <Dropdown
                        ariaLabel={`${member.name} 的工作区角色`}
                        disabled={isUpdatingId === member.id || isRemovingId === member.id}
                        onChange={(value) => {
                          void updateMemberRole(member.id, value as WorkspaceMemberRole);
                        }}
                        options={roleOptions}
                        value={memberRole}
                      />
                      <button
                        className="ghost-button workspace-members__remove"
                        disabled={isRemovingId === member.id || isUpdatingId === member.id}
                        onClick={() => {
                          void removeMember(member.id);
                        }}
                        type="button"
                      >
                        {isRemovingId === member.id ? "移除中…" : "移除"}
                      </button>
                    </div>
                  ) : (
                    <span className="workspace-members__role">{roleLabels[memberRole] ?? memberRole}</span>
                  )
              };
            })}
            layout="stack"
          />
        </div>
      </div>
    </Modal>
  );
}

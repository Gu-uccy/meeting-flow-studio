import { useEffect, useRef, useState, type FormEvent } from "react";
import { userRoleLabels } from "@meeting-flow/shared";
import { useAuth } from "../../../contexts/AuthContext";
import { dialog } from "../../../contexts/DialogContext";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { Modal } from "../../common/Modal";
import { canCreateWorkspace, canManageWorkspaceMembers, getProductRole, getWorkspaceProductRole } from "./navAccess";
import { WorkspaceMembersModal } from "./WorkspaceMembersModal";

type WorkspaceSwitcherProps = {
  onLogout: () => void;
  onOpenAccount: () => void;
};

function AccountAvatar({ label, size = "md" }: { label: string; size?: "md" | "lg" }) {
  return (
    <span aria-hidden="true" className={`workspace-hub__avatar workspace-hub__avatar--${size}`}>
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

function WorkspaceGlyph({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="workspace-hub__workspace-glyph">
      {name.trim().slice(0, 1).toUpperCase() || "W"}
    </span>
  );
}

export function WorkspaceSwitcher({ onLogout, onOpenAccount }: WorkspaceSwitcherProps) {
  const { user } = useAuth();
  const {
    items,
    activeWorkspace,
    isLoading,
    isSwitching,
    isCreating,
    isUpdating,
    error,
    canDeleteWorkspace,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace
  } = useWorkspace();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  const productRole = getProductRole(user);
  const canCreate = user ? canCreateWorkspace(productRole) : false;
  const canManageMembers = user ? canManageWorkspaceMembers(productRole) : false;
  const isBusy = isSwitching || isCreating || isUpdating;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!user) {
    return null;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) {
      return;
    }

    const workspace = await createWorkspace(name);
    if (workspace) {
      setWorkspaceName("");
      setIsCreateOpen(false);
      setIsOpen(false);
    }
  }

  async function handleSwitchWorkspace(workspaceId: string) {
    if (workspaceId === user?.workspaceId || isBusy) {
      setIsOpen(false);
      return;
    }

    const success = await switchWorkspace(workspaceId);
    if (success) {
      setIsOpen(false);
    }
  }

  function openAccount() {
    setIsOpen(false);
    onOpenAccount();
  }

  function openMembers() {
    setIsOpen(false);
    setIsMembersOpen(true);
  }

  function openCreate() {
    setIsOpen(false);
    setIsCreateOpen(true);
  }

  function openRename(workspace: { id: string; name: string }) {
    setRenameTarget(workspace);
    setWorkspaceName(workspace.name);
    setIsOpen(false);
    setIsRenameOpen(true);
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) {
      return;
    }
    const name = workspaceName.trim();
    if (!name || name === renameTarget.name) {
      return;
    }

    const workspace = await renameWorkspace(renameTarget.id, name);
    if (workspace) {
      setIsRenameOpen(false);
      setRenameTarget(null);
      setWorkspaceName("");
    }
  }

  async function handleDelete(workspace: { id: string; name: string }) {
    if (!canDeleteWorkspace(workspace.id)) {
      return;
    }
    const confirmed = await dialog.confirm({
      title: "删除工作区",
      description: `确定删除工作区「${workspace.name}」？预置工作区不可删，且仍有会议时无法删除。`,
      confirmLabel: "删除工作区",
      tone: "danger"
    });
    if (!confirmed) {
      return;
    }
    const success = await deleteWorkspace(workspace.id);
    if (success) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <div className={`workspace-hub${isOpen ? " is-open" : ""}`} ref={rootRef}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="workspace-hub__trigger"
          disabled={isBusy}
          onClick={() => setIsOpen((current) => !current)}
          title={`${user.name} · ${activeWorkspace?.name ?? "工作区"}`}
          type="button"
        >
          <AccountAvatar label={user.name} />
          <span className="workspace-hub__trigger-copy">
            <strong>{user.name}</strong>
            <span>{activeWorkspace?.name ?? "工作区"}</span>
          </span>
          <span aria-hidden="true" className="workspace-hub__chevron">
            <svg fill="none" height="10" viewBox="0 0 12 10" width="12">
              <path d="M2 3.5L6 7.5L10 3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
          </span>
        </button>

        {isOpen ? (
          <div className="workspace-hub__menu" role="menu">
            <header className="workspace-hub__profile">
              <AccountAvatar label={user.name} size="lg" />
              <div className="workspace-hub__profile-copy">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>{userRoleLabels[productRole]} · {activeWorkspace?.name ?? "默认工作区"}</small>
              </div>
            </header>

            <div className="workspace-hub__actions">
              <button className="workspace-hub__action" onClick={openAccount} role="menuitem" type="button">
                账号设置
              </button>
              {canManageMembers && activeWorkspace ? (
                <button className="workspace-hub__action" onClick={openMembers} role="menuitem" type="button">
                  成员管理
                </button>
              ) : null}
              {canCreate ? (
                <button className="workspace-hub__action" onClick={openCreate} role="menuitem" type="button">
                  新建工作区
                </button>
              ) : null}
            </div>

            <div className="workspace-hub__section">
              <span className="workspace-hub__section-label">{user.email}</span>
              {isLoading ? (
                <p className="workspace-hub__placeholder">加载工作区…</p>
              ) : (
                <ul className="workspace-hub__list">
                  {(items.length > 0 ? items : activeWorkspace ? [activeWorkspace] : []).map((workspace) => {
                    const isActive = workspace.id === user.workspaceId;
                    const canManageThis = canManageWorkspaceMembers(getWorkspaceProductRole(user, workspace.id));
                    return (
                      <li key={workspace.id}>
                        <div className={`workspace-hub__workspace-row${isActive ? " is-active" : ""}`}>
                          <button
                            className={`workspace-hub__workspace${isActive ? " is-active" : ""}`}
                            disabled={isBusy}
                            onClick={() => void handleSwitchWorkspace(workspace.id)}
                            role="menuitemradio"
                            aria-checked={isActive}
                            type="button"
                          >
                            <WorkspaceGlyph name={workspace.name} />
                            <span className="workspace-hub__workspace-copy">
                              <strong>{workspace.name}</strong>
                              {getWorkspaceProductRole(user, workspace.id) === "viewer" ? <small>访客</small> : null}
                            </span>
                            {isActive ? (
                              <span aria-hidden="true" className="workspace-hub__check">✓</span>
                            ) : null}
                          </button>
                          {canManageThis ? (
                            <div className="workspace-hub__workspace-tools">
                              <button
                                className="workspace-hub__tool"
                                disabled={isBusy}
                                onClick={() => openRename(workspace)}
                                title="重命名"
                                type="button"
                              >
                                改名
                              </button>
                              {canDeleteWorkspace(workspace.id) ? (
                                <button
                                  className="workspace-hub__tool workspace-hub__tool--danger"
                                  disabled={isBusy}
                                  onClick={() => void handleDelete(workspace)}
                                  title="删除"
                                  type="button"
                                >
                                  删除
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error ? <p className="workspace-hub__error">{error}</p> : null}
            {isBusy ? (
              <p className="workspace-hub__status">
                {isCreating ? "正在创建工作区…" : isUpdating ? "正在更新工作区…" : "正在切换工作区…"}
              </p>
            ) : null}

            <footer className="workspace-hub__footer">
              <button className="workspace-hub__logout" onClick={onLogout} role="menuitem" type="button">
                退出登录
              </button>
            </footer>
          </div>
        ) : null}
      </div>

      {isCreateOpen ? (
        <Modal
          footer={
            <>
              <button className="secondary-button" onClick={() => setIsCreateOpen(false)} type="button">
                取消
              </button>
              <button
                className="primary-button"
                disabled={isCreating || workspaceName.trim().length < 2}
                form="workspace-create-form"
                type="submit"
              >
                {isCreating ? "创建中…" : "创建工作区"}
              </button>
            </>
          }
          onClose={() => setIsCreateOpen(false)}
          size="sm"
          title="创建工作区"
        >
          <form className="workspace-create-form" id="workspace-create-form" onSubmit={handleCreate}>
            <label className="workspace-create-form__field">
              <span>工作区名称</span>
              <input
                autoFocus
                maxLength={40}
                minLength={2}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="例如：客户成功团队"
                required
                type="text"
                value={workspaceName}
              />
            </label>
            <p className="workspace-create-form__hint">创建后将自动切换到新工作区，会议与流程数据彼此隔离。</p>
          </form>
        </Modal>
      ) : null}

      {isRenameOpen && renameTarget ? (
        <Modal
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => {
                  setIsRenameOpen(false);
                  setRenameTarget(null);
                  setWorkspaceName("");
                }}
                type="button"
              >
                取消
              </button>
              <button
                className="primary-button"
                disabled={isUpdating || workspaceName.trim().length < 2 || workspaceName.trim() === renameTarget.name}
                form="workspace-rename-form"
                type="submit"
              >
                {isUpdating ? "保存中…" : "保存"}
              </button>
            </>
          }
          onClose={() => {
            setIsRenameOpen(false);
            setRenameTarget(null);
            setWorkspaceName("");
          }}
          size="sm"
          title="重命名工作区"
        >
          <form className="workspace-create-form" id="workspace-rename-form" onSubmit={handleRename}>
            <label className="workspace-create-form__field">
              <span>工作区名称</span>
              <input
                autoFocus
                maxLength={40}
                minLength={2}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                type="text"
                value={workspaceName}
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {isMembersOpen && activeWorkspace ? (
        <WorkspaceMembersModal
          onClose={() => setIsMembersOpen(false)}
          workspace={activeWorkspace}
        />
      ) : null}
    </>
  );
}

import { userRoleLabels } from "@meeting-flow/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { formatDateTime } from "../../lib/format";
import { AccountIntegrationOverview } from "./AccountIntegrationOverview";
import { MeetingAppsConnectionPanel } from "./MeetingAppsConnectionPanel";
import { AuditTimelinePanel } from "./AuditTimelinePanel";
import { PageShell } from "./layout/PageShell";
import {
  canManageMeetingAppConnections,
  canViewAccountIntegrations,
  canViewAuditLogs,
  getPlatformRole,
  getProductRole
} from "./layout/navAccess";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useAuditLogs } from "../../hooks/useAuditLogs";

export function AccountPage() {
  const { user } = useAuth();
  const { setWorkbenchView } = useWorkbench();
  const { activeWorkspace, items, canSwitch } = useWorkspace();
  const productRole = user ? getProductRole(user) : "viewer";
  const platformRole = user ? getPlatformRole(user) : "viewer";
  const auditLogs = useAuditLogs(undefined, user ? canViewAuditLogs(productRole) : false);

  if (!user) {
    return null;
  }

  const showIntegrations = canViewAccountIntegrations(platformRole);
  const showMeetingApps = canManageMeetingAppConnections(productRole);
  const showAuditLogs = canViewAuditLogs(productRole);

  return (
    <PageShell className="account-page" id="account-page">
      {showIntegrations ? (
        <AccountIntegrationOverview onOpenConfig={() => setWorkbenchView("config")} />
      ) : showMeetingApps ? (
        <MeetingAppsConnectionPanel />
      ) : (
        <header className="account-page__header">
          <div>
            <span className="section-kicker">Settings</span>
            <h1>账号设置</h1>
            <p>
              {productRole === "viewer"
                ? "观察者账号可查看基本信息与会中内容。"
                : "管理账号与工作区偏好。"}
            </p>
          </div>
        </header>
      )}

      <div className="account-page__grid">
        <article className="account-profile">
          <div className="account-profile__avatar" aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span>当前账号</span>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
        </article>

        <article className="account-panel">
          <h2>账号信息</h2>
          <dl className="account-detail-list">
            <div>
              <dt>姓名</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>平台角色</dt>
              <dd>{userRoleLabels[platformRole]}</dd>
            </div>
            <div>
              <dt>当前工作区角色</dt>
              <dd>{userRoleLabels[productRole]}</dd>
            </div>
            <div>
              <dt>当前工作区</dt>
              <dd>{activeWorkspace?.name ?? user.workspaceId}</dd>
            </div>
            {productRole !== "viewer" ? (
              <div>
                <dt>可访问工作区</dt>
                <dd>
                  {canSwitch
                    ? items.map((workspace) => workspace.name).join("、")
                    : (activeWorkspace?.name ?? "1 个")}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>账号 ID</dt>
              <dd>{user.id}</dd>
            </div>
          </dl>
        </article>

        <article className="account-panel">
          <h2>安全状态</h2>
          <dl className="account-detail-list">
            <div>
              <dt>登录状态</dt>
              <dd>已登录</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{formatDateTime(user.createdAt)}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatDateTime(user.updatedAt)}</dd>
            </div>
          </dl>
        </article>

        {showAuditLogs ? (
          <article className="account-panel account-panel--wide">
            <h2>操作审计</h2>
            <AuditTimelinePanel
              error={auditLogs.error}
              isLoading={auditLogs.isLoading}
              items={auditLogs.items}
              onReload={() => {
                void auditLogs.reload();
              }}
            />
          </article>
        ) : null}
      </div>
    </PageShell>
  );
}

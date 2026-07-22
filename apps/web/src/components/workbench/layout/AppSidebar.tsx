import { useAuth } from "../../../contexts/AuthContext";
import { useWorkbench } from "../../../contexts/WorkbenchContext";
import type { WorkbenchView } from "../../../contexts/WorkbenchContext";
import { NavIcon } from "./navIcons";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MeetingConnectionNavCard } from "./MeetingConnectionNavCard";
import {
  canAccessNodeAgentStudio,
  canOpenRunsConsole,
  getMeetingNavViews,
  getPlatformRole,
  getProductRole
} from "./navAccess";
import { workbenchViewMeta } from "./viewMeta";

type NavIconName = Parameters<typeof NavIcon>[0]["name"];

const navIconByView: Record<WorkbenchView, NavIconName> = {
  workspace: "workspace",
  meeting: "meeting",
  chat: "chat",
  knowledge: "knowledge",
  memories: "memories",
  "meeting-agent": "meeting-agent",
  config: "config",
  schedules: "schedules",
  runs: "runs",
  apps: "apps",
  account: "account"
};

type NavItem = {
  icon: NavIconName;
  onClick: () => void;
  view: WorkbenchView;
};

type AppSidebarProps = {
  onLogout: () => void;
};

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const { user } = useAuth();
  const { workbenchView, setWorkbenchView, openRunsConsole, feishuCalendar } = useWorkbench();
  const productRole = user ? getProductRole(user) : "editor";
  const platformRole = user ? getPlatformRole(user) : "editor";
  const needsMeetingConnection =
    productRole !== "viewer" &&
    feishuCalendar.isConfigured &&
    !feishuCalendar.isConnected;

  const meetingItems: NavItem[] = getMeetingNavViews(productRole).map((view) => ({
    view,
    icon: navIconByView[view],
    onClick: () => setWorkbenchView(view)
  }));

  const platformViews: WorkbenchView[] = [
    ...(canOpenRunsConsole(productRole) ? (["runs"] as const) : []),
    ...(canAccessNodeAgentStudio(platformRole) ? (["apps"] as const) : [])
  ];

  const platformItems: NavItem[] = platformViews.map((view) => ({
    view,
    icon: navIconByView[view],
    onClick: view === "runs" ? () => openRunsConsole() : () => setWorkbenchView(view)
  }));

  function renderNavButton(item: NavItem) {
    const meta = workbenchViewMeta[item.view];
    const isActive = workbenchView === item.view;
    const showAttention = item.view === "config" && needsMeetingConnection;

    return (
      <button
        aria-current={isActive ? "page" : undefined}
        className={`workbench-app__nav-button${isActive ? " is-active" : ""}${showAttention ? " is-attention" : ""}`}
        key={item.view}
        onClick={item.onClick}
        data-testid={`nav-${item.view}`}
        title={showAttention ? `${meta.label}（待连接飞书）` : meta.label}
        type="button"
      >
        <span aria-hidden="true" className="workbench-app__nav-icon">
          <NavIcon name={item.icon} />
        </span>
        <span className="workbench-app__nav-label">{meta.shortLabel}</span>
        {showAttention ? <span aria-hidden="true" className="workbench-app__nav-dot" /> : null}
      </button>
    );
  }

  return (
    <aside aria-label="工作台导航" className="workbench-app__sidebar">
      <div className="workbench-app__sidebar-top">
        <WorkspaceSwitcher
          onLogout={onLogout}
          onOpenAccount={() => setWorkbenchView("account")}
        />
        <MeetingConnectionNavCard />
      </div>

      <nav aria-label="主功能" className="workbench-app__nav">
        <div className="workbench-app__nav-group">
          <span className="workbench-app__nav-group-label">会议域</span>
          {meetingItems.map(renderNavButton)}
        </div>
        {platformItems.length > 0 ? (
          <div className="workbench-app__nav-group">
            <span className="workbench-app__nav-group-label">平台</span>
            {platformItems.map(renderNavButton)}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}

import { useAuth } from "../../../contexts/AuthContext";
import { useWorkbench } from "../../../contexts/WorkbenchContext";
import { canManageMeetingAppConnections, getProductRole } from "./navAccess";

/**
 * Sidebar entry for Feishu connection — always visible for editors/admins.
 */
export function MeetingConnectionNavCard() {
  const { user } = useAuth();
  const { feishuCalendar, setWorkbenchView, workbenchView } = useWorkbench();

  if (!user || !canManageMeetingAppConnections(getProductRole(user))) {
    return null;
  }

  const configured = feishuCalendar.isConfigured;
  const ready = configured && feishuCalendar.isConnected;
  const busy = feishuCalendar.isLoading || feishuCalendar.isMutating;

  const tone = !configured ? "danger" : ready ? "ready" : "warn";
  const statusLabel = !configured ? "未配置" : ready ? "已连接" : "待连接";
  const detail = !configured
    ? "需配置飞书 OAuth"
    : ready
      ? "飞书 · 日程与录制"
      : "连接飞书后才能绑定真实会议";

  return (
    <section
      aria-label="飞书连接"
      className={`workbench-app__connection-card workbench-app__connection-card--${tone}${workbenchView === "config" ? " is-active" : ""}`}
      data-testid="meeting-connection-nav-card"
    >
      <button
        className="workbench-app__connection-card__main"
        onClick={() => setWorkbenchView("config")}
        type="button"
      >
        <span className="workbench-app__connection-card__kicker">飞书会议</span>
        <strong className="workbench-app__connection-card__title">连接状态</strong>
        <span className={`workbench-app__connection-card__badge workbench-app__connection-card__badge--${tone}`}>
          {statusLabel}
        </span>
        <p className="workbench-app__connection-card__detail">{detail}</p>
      </button>

      {!ready && configured ? (
        <button
          className="primary-button workbench-app__connection-card__cta"
          disabled={busy || feishuCalendar.isConnected}
          onClick={() => void feishuCalendar.connectFeishuCalendar()}
          type="button"
        >
          {feishuCalendar.isMutating ? "连接中..." : "连接飞书"}
        </button>
      ) : (
        <button
          className="ghost-button workbench-app__connection-card__cta"
          onClick={() => setWorkbenchView("config")}
          type="button"
        >
          {ready ? "管理连接" : "打开连接页"}
        </button>
      )}
    </section>
  );
}

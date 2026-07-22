import { useAuth } from "../../../contexts/AuthContext";
import { useWorkbench } from "../../../contexts/WorkbenchContext";
import { canManageMeetingAppConnections, getProductRole } from "./navAccess";

type ConnectionTone = "ready" | "warn" | "danger" | "muted";

function toneClass(tone: ConnectionTone) {
  return `meeting-connection-strip__badge meeting-connection-strip__badge--${tone}`;
}

/**
 * Persistent strip under the app header: Feishu connection is a product prerequisite.
 * Always visible for editors/admins (compact when connected).
 */
export function MeetingConnectionStrip() {
  const { user } = useAuth();
  const { feishuCalendar, setWorkbenchView, workbenchView } = useWorkbench();

  if (!user || !canManageMeetingAppConnections(getProductRole(user))) {
    return null;
  }

  if (workbenchView === "config") {
    return null;
  }

  const configured = feishuCalendar.isConfigured;
  const ready = configured && feishuCalendar.isConnected;
  const busy = feishuCalendar.isLoading || feishuCalendar.isMutating;

  if (!configured) {
    return (
      <div className="meeting-connection-strip meeting-connection-strip--danger" data-testid="meeting-connection-strip" role="status">
        <div className="meeting-connection-strip__copy">
          <span className={toneClass("danger")}>未配置</span>
          <strong>飞书未配置</strong>
          <p>请在服务端配置飞书 OAuth。流程需绑定真实会议与录音才能完整执行。</p>
        </div>
        <div className="meeting-connection-strip__actions">
          <button className="ghost-button" onClick={() => setWorkbenchView("account")} type="button">
            查看集成说明
          </button>
        </div>
      </div>
    );
  }

  if (ready) {
    return (
      <div className="meeting-connection-strip meeting-connection-strip--ready" data-testid="meeting-connection-strip" role="status">
        <div className="meeting-connection-strip__copy">
          <span className={toneClass("ready")}>已连接</span>
          <strong>飞书已连接</strong>
          <p>可同步日程与视频会议；会后在会议连接页刷新录制，再跑纪要节点。</p>
        </div>
        <div className="meeting-connection-strip__actions">
          <button className="ghost-button" onClick={() => setWorkbenchView("config")} type="button">
            管理飞书连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-connection-strip meeting-connection-strip--warn" data-testid="meeting-connection-strip" role="status">
      <div className="meeting-connection-strip__copy">
        <span className={toneClass("warn")}>待连接</span>
        <strong>请先连接飞书</strong>
        <p>Meeting Flow 以真实会议为锚点：连接飞书后，才能同步视频会议并在会后拉取录音整理纪要。</p>
      </div>
      <div className="meeting-connection-strip__actions">
        <button
          className="primary-button"
          disabled={busy || feishuCalendar.isConnected}
          onClick={() => void feishuCalendar.connectFeishuCalendar()}
          type="button"
        >
          {feishuCalendar.isMutating ? "连接中..." : "连接飞书"}
        </button>
        <button className="ghost-button" onClick={() => setWorkbenchView("config")} type="button">
          打开会议连接
        </button>
      </div>
    </div>
  );
}

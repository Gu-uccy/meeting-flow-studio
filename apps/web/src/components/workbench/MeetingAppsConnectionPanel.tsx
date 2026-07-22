import { useWorkbench } from "../../contexts/WorkbenchContext";
import { getCalendarIntegrationStatus } from "../../lib/accountIntegrationUtils";
import { StatusBanner } from "../common/StatusBanner";

/**
 * Shortcut on the account page: Feishu status + jump to the unified config page.
 */
export function MeetingAppsConnectionPanel() {
  const { feishuCalendar, setWorkbenchView } = useWorkbench();

  const feishuStatus = getCalendarIntegrationStatus({
    providerLabel: "飞书会议",
    isConfigured: feishuCalendar.isConfigured,
    isConnected: feishuCalendar.isConnected,
    isLoading: feishuCalendar.isLoading,
    statusMessage: feishuCalendar.statusMessage
  });

  const feedback = feishuCalendar.feedback;
  const error = feishuCalendar.error;
  const busy = feishuCalendar.isMutating;

  return (
    <section className="meeting-apps-panel" aria-label="工作台配置入口">
      <header className="meeting-apps-panel__header">
        <div>
          <span className="section-kicker">Config</span>
          <h2>工作台配置</h2>
          <p>AI 服务密钥与飞书会议连接已合并到配置页统一管理。</p>
        </div>
        <button className="primary-button" onClick={() => setWorkbenchView("config")} type="button">
          打开配置页
        </button>
      </header>

      {(error || feedback) && <StatusBanner error={error || ""} feedback={feedback || ""} />}

      <div className="meeting-apps-panel__grid">
        <article className={`account-integration-card account-integration-card--${feishuStatus.tone}`}>
          <div className="account-integration-card__head">
            <strong>飞书会议</strong>
            <span className={`integration-badge integration-badge--${feishuStatus.tone}`}>{feishuStatus.label}</span>
          </div>
          <p>{feishuStatus.detail}</p>
          <div className="account-integration-card__actions">
            <button
              className="ghost-button"
              disabled={busy || !feishuCalendar.isConfigured || feishuCalendar.isConnected}
              onClick={() => void feishuCalendar.connectFeishuCalendar()}
              type="button"
            >
              {feishuCalendar.isConnected ? "飞书已连接" : "连接飞书"}
            </button>
            <button className="ghost-button" onClick={() => setWorkbenchView("config")} type="button">
              管理配置
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

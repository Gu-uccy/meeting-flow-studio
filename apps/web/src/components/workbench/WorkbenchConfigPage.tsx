import type { MeetingExternalMeeting, MeetingRecordWithPermissions } from "@meeting-flow/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { getCalendarIntegrationStatus } from "../../lib/accountIntegrationUtils";
import { AiServiceSettingsPanel } from "./AiServiceSettingsPanel";
import { MeetingReadOnlyBanner } from "./layout/MeetingReadOnlyBanner";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";
import { canManageAiSettings, canManageMeetingAppConnections, getProductRole, isMeetingReadOnly } from "./layout/navAccess";

type WorkbenchConfigPageProps = {
  hint?: string | null;
  meeting: MeetingRecordWithPermissions | null;
  onConnectFeishuCalendar: () => void;
  onRefreshFeishuMeeting: () => void;
  onSyncFeishuCalendar: () => void;
  canSyncFeishuCalendar: boolean;
  feishuCalendarStatusMessage?: string;
  feishuRedirectUri?: string;
  isBusy?: boolean;
  isFeishuCalendarConfigured: boolean;
  isFeishuCalendarConnected: boolean;
  isFeishuCalendarLoading: boolean;
  readOnly?: boolean;
};

function recordingStatusLabel(status: MeetingExternalMeeting["recordingStatus"] | undefined) {
  switch (status) {
    case "ready":
      return "录音就绪";
    case "pending":
      return "等待录音";
    case "failed":
      return "拉取失败";
    default:
      return "未绑定";
  }
}

function transcriptStatusLabel(status: MeetingExternalMeeting["transcriptStatus"] | undefined) {
  switch (status) {
    case "ready":
      return "转写就绪";
    case "pending":
      return "等待转写";
    case "failed":
      return "转写失败";
    default:
      return "无转写";
  }
}

function externalMeetingReady(meeting: MeetingRecordWithPermissions) {
  const external = meeting.externalMeeting?.provider === "feishu" ? meeting.externalMeeting : null;
  return Boolean(external?.meetingNo || external?.meetingId || external?.calendarEventId || meeting.meetingLink);
}

/**
 * Unified workspace config — same meeting-tool-page shell as Agent / Schedules.
 */
export function WorkbenchConfigPage({
  hint,
  meeting,
  onConnectFeishuCalendar,
  onRefreshFeishuMeeting,
  onSyncFeishuCalendar,
  canSyncFeishuCalendar,
  feishuCalendarStatusMessage = "",
  feishuRedirectUri = "",
  isBusy = false,
  isFeishuCalendarConfigured,
  isFeishuCalendarConnected,
  isFeishuCalendarLoading,
  readOnly = false
}: WorkbenchConfigPageProps) {
  const { user } = useAuth();
  const { feishuCalendar, aiSettings } = useWorkbench();
  const role = getProductRole(user);
  const showAi = canManageAiSettings(role);
  const showMeetingApps = canManageMeetingAppConnections(role);
  const meetingReadOnly = readOnly || isMeetingReadOnly(meeting);
  const busy = isBusy || isFeishuCalendarLoading || feishuCalendar.isMutating;

  const feishuStatus = getCalendarIntegrationStatus({
    providerLabel: "飞书会议",
    isConfigured: isFeishuCalendarConfigured,
    isConnected: isFeishuCalendarConnected,
    isLoading: isFeishuCalendarLoading || feishuCalendar.isLoading,
    statusMessage: feishuCalendarStatusMessage || feishuCalendar.statusMessage
  });

  const aiLabel =
    aiSettings.settings.keySource === "none"
      ? "未配置"
      : aiSettings.settings.keySource === "user"
        ? "用户 Key"
        : "环境 Key";

  const meetingLabel = meeting
    ? externalMeetingReady(meeting)
      ? "已绑定"
      : "待同步"
    : "未选择";

  const externalMeeting = meeting?.externalMeeting?.provider === "feishu" ? meeting.externalMeeting : null;
  const canRefreshFeishu =
    Boolean(meeting) &&
    canSyncFeishuCalendar &&
    Boolean(
      externalMeeting?.calendarEventId ||
        externalMeeting?.meetingNo ||
        externalMeeting?.meetingId ||
        meeting?.meetingLink
    );

  const feedback = [feishuCalendar.error, feishuCalendar.feedback, showAi ? aiSettings.error : "", showAi ? aiSettings.feedback : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <MeetingWorkspaceLayout hint={hint}>
      <section className="meeting-tool-page config-page" aria-label="工作台配置">
        {meeting ? <MeetingReadOnlyBanner meeting={meeting} /> : null}

        <div className="meeting-tool-page__meta config-page__meta" aria-label="配置概览">
          <div className="config-page__meta-stats">
            {showAi ? (
              <span>
                AI <strong>{aiLabel}</strong>
              </span>
            ) : null}
            {showMeetingApps ? (
              <span>
                飞书 <strong>{feishuStatus.label}</strong>
              </span>
            ) : null}
            <span>
              会议 <strong>{meetingLabel}</strong>
            </span>
          </div>
          <div className="meeting-tool-page__header-actions">
            {showMeetingApps && !isFeishuCalendarConnected ? (
              <button
                className="primary-button"
                disabled={busy || !isFeishuCalendarConfigured || meetingReadOnly}
                onClick={onConnectFeishuCalendar}
                type="button"
              >
                连接飞书
              </button>
            ) : null}
            {meeting && !meetingReadOnly ? (
              <>
                <button
                  className="ghost-button"
                  disabled={busy || !canSyncFeishuCalendar}
                  onClick={onSyncFeishuCalendar}
                  type="button"
                >
                  {isFeishuCalendarLoading ? "同步中..." : "同步飞书会议"}
                </button>
                <button
                  className="ghost-button"
                  disabled={busy || !canRefreshFeishu}
                  onClick={onRefreshFeishuMeeting}
                  type="button"
                >
                  刷新录制
                </button>
              </>
            ) : null}
          </div>
        </div>

        {feedback ? <p className="meeting-tool-page__feedback">{feedback}</p> : null}

        <div className="meeting-tool-page__body config-page__body">
          {showAi ? (
            <section className="meeting-tool-page__section" aria-label="AI 服务">
              <div className="meeting-tool-page__section-title">
                <strong>AI 服务</strong>
                <span>{aiLabel}</span>
              </div>
              <p className="config-page__section-hint">
                OpenAI 兼容协议。一把 Key 用于对话、Agent、AI 节点与知识向量检索。
              </p>
              <AiServiceSettingsPanel />
            </section>
          ) : null}

          {showMeetingApps ? (
            <section className="meeting-tool-page__section" aria-label="飞书会议">
              <div className="meeting-tool-page__section-title">
                <strong>飞书会议</strong>
                <span>{feishuStatus.label}</span>
              </div>
              <p className="config-page__section-hint">
                连接后可同步日程、视频会议，并在会后拉取录音整理纪要。
              </p>
              <div className={`account-integration-card account-integration-card--${feishuStatus.tone}`}>
                <div className="account-integration-card__head">
                  <strong>飞书会议</strong>
                  <span className={`integration-badge integration-badge--${feishuStatus.tone}`}>{feishuStatus.label}</span>
                </div>
                <p>{feishuStatus.detail}</p>
                <div className="account-integration-card__actions">
                  <button
                    className="primary-button"
                    disabled={busy || !isFeishuCalendarConfigured || isFeishuCalendarConnected || meetingReadOnly}
                    onClick={onConnectFeishuCalendar}
                    type="button"
                  >
                    {isFeishuCalendarConnected ? "飞书已连接" : "连接飞书"}
                  </button>
                </div>
              </div>
              {feishuRedirectUri ? (
                <div className="calendar-page__redirects">
                  <code>Feishu Redirect: {feishuRedirectUri}</code>
                </div>
              ) : null}
              {!isFeishuCalendarConfigured ? (
                <p className="meeting-tool-page__banner" role="status">
                  飞书 OAuth 未配置：请先在服务端填写 FEISHU_APP_ID / FEISHU_APP_SECRET。
                </p>
              ) : null}

              <div className="config-page__meeting-block">
                <div className="meeting-tool-page__section-title">
                  <strong>当前会议绑定</strong>
                  <span>{meeting ? meeting.title : "未选择"}</span>
                </div>
                {meeting ? (
                  <div className="meeting-tool-page__rows">
                    <article className="meeting-tool-page__row">
                      <strong>录制状态</strong>
                      <small>{recordingStatusLabel(externalMeeting?.recordingStatus)}</small>
                    </article>
                    <article className="meeting-tool-page__row">
                      <strong>转写状态</strong>
                      <small>{transcriptStatusLabel(externalMeeting?.transcriptStatus)}</small>
                    </article>
                    <article className="meeting-tool-page__row">
                      <strong>会议号</strong>
                      <small>{externalMeeting?.meetingNo || "—"}</small>
                    </article>
                    <article className="meeting-tool-page__row">
                      <strong>会中实例</strong>
                      <small>{externalMeeting?.meetingId || "开会后才会生成"}</small>
                    </article>
                    <article className="meeting-tool-page__row">
                      <strong>入会链接</strong>
                      <small>
                        {externalMeeting?.meetingUrl || meeting.meetingLink ? (
                          <a href={externalMeeting?.meetingUrl || meeting.meetingLink} rel="noreferrer" target="_blank">
                            打开飞书会议
                          </a>
                        ) : (
                          "—"
                        )}
                      </small>
                    </article>
                    {externalMeeting?.statusMessage ? (
                      <article className="meeting-tool-page__row">
                        <strong>说明</strong>
                        <small>{externalMeeting.statusMessage}</small>
                      </article>
                    ) : null}
                  </div>
                ) : (
                  <p className="meeting-tool-page__empty">从顶栏选择会议后，可在此同步飞书日程并刷新录制状态。</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </MeetingWorkspaceLayout>
  );
}

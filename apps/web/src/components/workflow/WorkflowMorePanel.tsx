import { useState } from "react";
import type { MeetingAgentRun, MeetingRecord } from "@meeting-flow/shared";
import { agentActionPriorityLabels } from "./workflowPanelUtils";
import { WorkflowSideTabs, workflowExtensionTabs, type WorkflowExtensionTab } from "./WorkflowSideTabs";

type WorkflowMorePanelProps = {
  agentError: string;
  agentRun: MeetingAgentRun | null;
  calendarStatusMessage: string;
  canSyncFeishuCalendar: boolean;
  canSyncGoogleCalendar: boolean;
  feishuCalendarStatusMessage: string;
  feishuRedirectUri: string;
  googleRedirectUri: string;
  isAgentRunning: boolean;
  isCalendarLoading: boolean;
  isFeishuCalendarConfigured: boolean;
  isFeishuCalendarConnected: boolean;
  isFeishuCalendarLoading: boolean;
  isGoogleCalendarConfigured: boolean;
  isGoogleCalendarConnected: boolean;
  isWorkflowActionBusy: boolean;
  onConnectFeishuCalendar: () => void;
  onConnectGoogleCalendar: () => void;
  onRunAgent: () => void;
  onSyncFeishuCalendar: () => void;
  onSyncGoogleCalendar: () => void;
  selectedMeeting: MeetingRecord | null;
};

export function WorkflowMorePanel(props: WorkflowMorePanelProps) {
  const {
    agentError,
    agentRun,
    calendarStatusMessage,
    canSyncFeishuCalendar,
    canSyncGoogleCalendar,
    feishuCalendarStatusMessage,
    feishuRedirectUri,
    googleRedirectUri,
    isAgentRunning,
    isCalendarLoading,
    isFeishuCalendarConfigured,
    isFeishuCalendarConnected,
    isFeishuCalendarLoading,
    isGoogleCalendarConfigured,
    isGoogleCalendarConnected,
    isWorkflowActionBusy,
    onConnectFeishuCalendar,
    onConnectGoogleCalendar,
    onRunAgent,
    onSyncFeishuCalendar,
    onSyncGoogleCalendar,
    selectedMeeting
  } = props;

  const [activeTab, setActiveTab] = useState<WorkflowExtensionTab>("agent");

  return (
    <div className="workflow-support-panel workflow-support-panel--tabbed workflow-support-panel--extension" aria-label="拓展工具">
      <WorkflowSideTabs
        activeTab={activeTab}
        ariaLabel="拓展工具视图"
        onChange={setActiveTab}
        tabs={workflowExtensionTabs}
      />

      {activeTab === "agent" && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">拓展工具</span>
            <strong>工作流 Agent</strong>
            <p>自动匹配模板并推进会议流程。</p>
          </div>

          <section className="meeting-agent-card" aria-label="工作流 Agent">
            <div className="ide-section-title">
              <strong>Agent 状态</strong>
              <span>{agentRun ? agentRun.model : "待运行"}</span>
            </div>
            {agentError ? <p className="memory-empty">{agentError}</p> : null}
            <p className="meeting-agent-card__summary">
              {agentRun?.summary ?? "选择会议后可运行 Agent 辅助推进流程。"}
            </p>
            <button
              className="primary-button meeting-agent-card__button"
              disabled={!selectedMeeting || isWorkflowActionBusy}
              onClick={() => void onRunAgent()}
              type="button"
            >
              {isAgentRunning ? "Agent 运行中" : "运行 Agent"}
            </button>
            {agentRun && agentRun.actions.length > 0 && (
              <div className="meeting-agent-card__list">
                {agentRun.actions.slice(0, 2).map((action) => (
                  <article className={`meeting-agent-card__item priority-${action.priority}`} key={action.id}>
                    <span>{agentActionPriorityLabels[action.priority]}</span>
                    <strong>{action.title}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">拓展工具</span>
            <strong>日历同步</strong>
            <p>将会议同步到 Google 或飞书日历。</p>
          </div>

          {selectedMeeting ? (
            <section className="calendar-integration-card workflow-side-panel__section" aria-label="日历同步">
              <div>
                <span>日历同步</span>
                <strong>Google / 飞书</strong>
                <p>{calendarStatusMessage || feishuCalendarStatusMessage || "将会议同步到外部日历。"}</p>
              </div>
              <div className="calendar-integration-card__actions">
                <button className="ghost-button" disabled={isWorkflowActionBusy || isCalendarLoading || !canSyncGoogleCalendar} onClick={() => void onSyncGoogleCalendar()} type="button">同步 Google</button>
                <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !canSyncFeishuCalendar} onClick={() => void onSyncFeishuCalendar()} type="button">同步飞书</button>
              </div>
              <details className="workflow-side-panel__dev">
                <summary>连接配置</summary>
                <div className="calendar-integration-card__actions">
                  <button className="ghost-button" disabled={isWorkflowActionBusy || isCalendarLoading || !isGoogleCalendarConfigured || isGoogleCalendarConnected} onClick={() => void onConnectGoogleCalendar()} type="button">连接 Google</button>
                  <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !isFeishuCalendarConfigured || isFeishuCalendarConnected} onClick={() => void onConnectFeishuCalendar()} type="button">连接飞书</button>
                </div>
                {(googleRedirectUri || feishuRedirectUri) && (
                  <div className="workflow-side-panel__dev-meta">
                    {googleRedirectUri && <code>Google: {googleRedirectUri}</code>}
                    {feishuRedirectUri && <code>Feishu: {feishuRedirectUri}</code>}
                  </div>
                )}
              </details>
            </section>
          ) : (
            <p className="memory-empty">请先从左侧选择一场会议，再同步日历。</p>
          )}
        </div>
      )}
    </div>
  );
}

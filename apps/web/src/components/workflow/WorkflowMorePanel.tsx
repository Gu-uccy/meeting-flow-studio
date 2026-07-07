import { useState } from "react";
import type { MeetingAgentRun, MeetingRecord, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { useWorkflowSchedules } from "../../hooks/useWorkflowSchedules";
import { agentActionPriorityLabels } from "./workflowPanelUtils";
import { WorkflowSideTabs, workflowExtensionTabs, type WorkflowExtensionTab } from "./WorkflowSideTabs";

const cronPresets = [
  { label: "每日 08:00", value: "0 8 * * *" },
  { label: "每周一 09:00", value: "0 9 * * 1" },
  { label: "每小时整点", value: "0 * * * *" }
] as const;

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
  workflowTemplates: ProductWorkflowTemplate[];
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
    selectedMeeting,
    workflowTemplates
  } = props;

  const [activeTab, setActiveTab] = useState<WorkflowExtensionTab>("agent");
  const [scheduleTemplateId, setScheduleTemplateId] = useState("");
  const [scheduleCron, setScheduleCron] = useState<string>(cronPresets[0].value);
  const schedules = useWorkflowSchedules(true);

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

      {activeTab === "schedules" && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">拓展工具</span>
            <strong>定时任务</strong>
            <p>按 Cron 表达式自动启动工作流。</p>
          </div>

          <section className="workflow-side-panel__section" aria-label="创建定时任务">
            <div className="ide-section-title">
              <strong>新建计划</strong>
              <span>{schedules.isLoading ? "加载中" : `${schedules.items.length} 条`}</span>
            </div>
            <label>
              <span>工作流模板</span>
              <select
                onChange={(event) => setScheduleTemplateId(event.target.value)}
                value={scheduleTemplateId || workflowTemplates[0]?.id || ""}
              >
                {workflowTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Cron 表达式</span>
              <input onChange={(event) => setScheduleCron(event.target.value)} placeholder="0 8 * * *" value={scheduleCron} />
            </label>
            <div className="filter-strip">
              {cronPresets.map((preset) => (
                <button
                  className={`filter-chip${scheduleCron === preset.value ? " is-active" : ""}`}
                  key={preset.value}
                  onClick={() => setScheduleCron(preset.value)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              className="primary-button"
              disabled={isWorkflowActionBusy || schedules.isMutating || !scheduleTemplateId && !workflowTemplates[0]?.id}
              onClick={() => void schedules.createSchedule(scheduleTemplateId || workflowTemplates[0]?.id || "", scheduleCron)}
              type="button"
            >
              {schedules.isMutating ? "创建中..." : "创建定时任务"}
            </button>
            {schedules.error ? <p className="memory-empty">{schedules.error}</p> : null}
            {schedules.feedback ? <p className="workflow-side-panel__feedback">{schedules.feedback}</p> : null}
          </section>

          <section className="workflow-side-panel__section" aria-label="定时任务列表">
            <div className="ide-section-title">
              <strong>已创建任务</strong>
            </div>
            {schedules.items.length === 0 ? (
              <p className="memory-empty">暂无定时任务。</p>
            ) : (
              schedules.items.map((schedule) => {
                const template = workflowTemplates.find((item) => item.id === schedule.templateId);
                return (
                  <article className="ide-list-row ide-list-row--action" key={schedule.id}>
                    <div>
                      <strong>{template?.name ?? schedule.templateId}</strong>
                      <small>{schedule.cronExpression}{schedule.lastTriggeredAt ? ` · 上次 ${new Date(schedule.lastTriggeredAt).toLocaleString("zh-CN")}` : ""}</small>
                    </div>
                    <button
                      className="ghost-button"
                      disabled={isWorkflowActionBusy || schedules.isMutating}
                      onClick={() => void schedules.deleteSchedule(schedule.id)}
                      type="button"
                    >
                      删除
                    </button>
                  </article>
                );
              })
            )}
          </section>
        </div>
      )}
    </div>
  );
}

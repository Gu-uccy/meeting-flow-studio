import { useState } from "react";
import { miniDifyNodeCapabilityCatalog, type MeetingAgentRun, type MeetingRecord, type ProductWorkflowTemplate, type MeetingAgentAction } from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";
import { SelectableCardList } from "../common/SelectableCardList";
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
  agentActionFeedback: string;
  agentRun: MeetingAgentRun | null;
  canSyncFeishuCalendar: boolean;
  feishuCalendarStatusMessage: string;
  feishuRedirectUri: string;
  isAgentRunning: boolean;
  isFeishuCalendarConfigured: boolean;
  isFeishuCalendarConnected: boolean;
  isFeishuCalendarLoading: boolean;
  isWorkflowActionBusy: boolean;
  onConnectFeishuCalendar: () => void;
  onExecuteAgentAction: (action: MeetingAgentAction) => void;
  onRefreshFeishuMeeting: () => void;
  onRunAgent: () => void;
  onSyncFeishuCalendar: () => void;
  readOnly?: boolean;
  selectedMeeting: MeetingRecord | null;
  workflowTemplates: ProductWorkflowTemplate[];
  forcedTab?: WorkflowExtensionTab;
  hideTabs?: boolean;
};

export function WorkflowMorePanel(props: WorkflowMorePanelProps) {
  const {
    agentError,
    agentActionFeedback,
    agentRun,
    canSyncFeishuCalendar,
    feishuCalendarStatusMessage,
    feishuRedirectUri,
    forcedTab,
    hideTabs = false,
    isAgentRunning,
    isFeishuCalendarConfigured,
    isFeishuCalendarConnected,
    isFeishuCalendarLoading,
    isWorkflowActionBusy,
    onConnectFeishuCalendar,
    onExecuteAgentAction,
    onRefreshFeishuMeeting,
    onRunAgent,
    onSyncFeishuCalendar,
    readOnly = false,
    selectedMeeting,
    workflowTemplates
  } = props;

  const [internalTab, setInternalTab] = useState<WorkflowExtensionTab>("agent");
  const activeTab = forcedTab ?? internalTab;
  const [scheduleTemplateId, setScheduleTemplateId] = useState("");
  const [scheduleMeetingId, setScheduleMeetingId] = useState("");
  const [scheduleCron, setScheduleCron] = useState<string>(cronPresets[0].value);
  const schedules = useWorkflowSchedules(true);

  const panelBody = (
    <>
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
            {!readOnly ? (
              <button
                className="primary-button meeting-agent-card__button"
                disabled={!selectedMeeting || isWorkflowActionBusy}
                onClick={() => void onRunAgent()}
                type="button"
              >
                {isAgentRunning ? "Agent 运行中" : "运行 Agent"}
              </button>
            ) : null}
            {agentActionFeedback ? <p className="workflow-side-panel__feedback">{agentActionFeedback}</p> : null}
            {!readOnly && agentRun && agentRun.actions.length > 0 ? (
              <SelectableCardList
                ariaLabel="Agent 建议动作"
                className="meeting-agent-card__list"
                items={agentRun.actions
                  .filter((action) => action.kind !== "none")
                  .slice(0, 4)
                  .map((action) => ({
                    id: action.id,
                    title: action.title,
                    badge: agentActionPriorityLabels[action.priority],
                    description: action.description,
                    className: `selectable-card--badge-leading priority-${action.priority}`,
                    disabled: isWorkflowActionBusy || action.kind === "none"
                  }))}
                layout="stack"
                onSelect={(id) => {
                  const action = agentRun.actions.find((item) => item.id === id);
                  if (action) {
                    void onExecuteAgentAction(action);
                  }
                }}
              />
            ) : null}
          </section>
        </div>
      )}

      {activeTab === "config" && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">拓展工具</span>
            <strong>飞书会议</strong>
            <p>同步日程、绑定飞书视频会议，并在会后刷新录制状态。</p>
          </div>

          {selectedMeeting ? (
            <section className="calendar-integration-card workflow-side-panel__section" aria-label="飞书同步">
              <div>
                <span>飞书同步</span>
                <strong>飞书日历与视频会议</strong>
                <p>{feishuCalendarStatusMessage || "将会议同步到飞书日历与视频会议。"}</p>
                {selectedMeeting.externalMeeting?.provider === "feishu" ? (
                  <p>
                    录制：{selectedMeeting.externalMeeting.recordingStatus}
                    {selectedMeeting.externalMeeting.statusMessage
                      ? ` · ${selectedMeeting.externalMeeting.statusMessage}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="calendar-integration-card__actions">
                {!readOnly ? (
                  <>
                    <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !canSyncFeishuCalendar} onClick={() => void onSyncFeishuCalendar()} type="button">同步飞书会议</button>
                    <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !canSyncFeishuCalendar} onClick={() => void onRefreshFeishuMeeting()} type="button">刷新录制状态</button>
                  </>
                ) : null}
              </div>
              {!readOnly ? (
              <details className="workflow-side-panel__dev">
                <summary>连接配置</summary>
                <div className="calendar-integration-card__actions">
                  <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !isFeishuCalendarConfigured || isFeishuCalendarConnected} onClick={() => void onConnectFeishuCalendar()} type="button">连接飞书</button>
                </div>
                {feishuRedirectUri && (
                  <div className="workflow-side-panel__dev-meta">
                    <code>Feishu: {feishuRedirectUri}</code>
                  </div>
                )}
              </details>
              ) : null}
            </section>
          ) : (
            <p className="memory-empty">请先从顶栏选择一场会议，再同步日历。</p>
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

          {!readOnly ? (
          <section className="workflow-side-panel__section" aria-label="创建定时任务">
            <div className="ide-section-title">
              <strong>新建计划</strong>
              <span>{schedules.isLoading ? "加载中" : `${schedules.items.length} 条`}</span>
            </div>
            <label className="workflow-side-panel__field">
              <span>工作流模板</span>
              <Dropdown
                onChange={setScheduleTemplateId}
                options={workflowTemplates.map((template) => ({
                  label: template.name,
                  value: template.id
                }))}
                value={scheduleTemplateId || workflowTemplates[0]?.id || ""}
              />
            </label>
            <label className="workflow-side-panel__field">
              <span>绑定会议</span>
              <Dropdown
                onChange={setScheduleMeetingId}
                options={[
                  { label: "自动匹配（按模板类别）", value: "" },
                  ...(selectedMeeting ? [{ label: selectedMeeting.title, value: selectedMeeting.id }] : [])
                ]}
                value={scheduleMeetingId || selectedMeeting?.id || ""}
              />
            </label>
            <label className="workflow-side-panel__field">
              <span>Cron 表达式</span>
              <input onChange={(event) => setScheduleCron(event.target.value)} placeholder="0 8 * * *" value={scheduleCron} />
            </label>
            <div className="workflow-side-panel__toolbar workflow-side-panel__toolbar--chips filter-strip">
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
            <div className="workflow-side-panel__toolbar">
              <button
                className="primary-button"
                disabled={isWorkflowActionBusy || schedules.isMutating || !scheduleTemplateId && !workflowTemplates[0]?.id}
                onClick={() => void schedules.createSchedule(
                  scheduleTemplateId || workflowTemplates[0]?.id || "",
                  scheduleCron,
                  scheduleMeetingId || selectedMeeting?.id || undefined
                )}
                type="button"
              >
                {schedules.isMutating ? "创建中..." : "创建定时任务"}
              </button>
            </div>
            {schedules.error ? <p className="memory-empty">{schedules.error}</p> : null}
            {schedules.feedback ? <p className="workflow-side-panel__feedback">{schedules.feedback}</p> : null}
          </section>
          ) : null}

          <section className="workflow-side-panel__section" aria-label="定时任务列表">
            <div className="ide-section-title">
              <strong>已创建任务</strong>
            </div>
            <SelectableCardList
              ariaLabel="定时任务"
              empty={<p className="memory-empty">暂无定时任务。</p>}
              items={schedules.items.map((schedule) => {
                const template = workflowTemplates.find((item) => item.id === schedule.templateId);
                const latestHistory = schedule.executionHistory?.[0];
                return {
                  id: schedule.id,
                  title: template?.name ?? schedule.templateId,
                  description: [
                    schedule.cronExpression,
                    schedule.meetingId ? `会议 ${schedule.meetingId}` : null,
                    schedule.lastTriggeredAt ? `上次 ${new Date(schedule.lastTriggeredAt).toLocaleString("zh-CN")}` : null,
                    latestHistory ? `最近运行 ${latestHistory.status}` : null
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  actions: !readOnly ? (
                    <>
                      <button
                        className="ghost-button"
                        disabled={isWorkflowActionBusy || schedules.isMutating}
                        onClick={() => void schedules.updateSchedule(schedule.id, { enabled: !schedule.enabled })}
                        type="button"
                      >
                        {schedule.enabled ? "停用" : "启用"}
                      </button>
                      <button
                        className="ghost-button"
                        disabled={isWorkflowActionBusy || schedules.isMutating}
                        onClick={() => void schedules.deleteSchedule(schedule.id)}
                        type="button"
                      >
                        删除
                      </button>
                    </>
                  ) : undefined
                };
              })}
              layout="stack"
            />
          </section>
        </div>
      )}

      {activeTab === "capabilities" && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">拓展工具</span>
            <strong>能力模型</strong>
            <p>与 Dify 节点能力对齐的产品矩阵。</p>
          </div>

          <section className="workflow-side-panel__section node-capability-catalog" aria-label="节点能力矩阵">
            <SelectableCardList
              ariaLabel="节点能力"
              items={miniDifyNodeCapabilityCatalog.map((capability) => ({
                id: capability.kind,
                title: capability.name,
                badge: capability.difyLikeName,
                description: capability.purpose,
                meta: `配置：${capability.requiredConfig.join(" · ")} · 输出：${capability.runtimeOutput.join(" · ")}`,
                className: `node-capability--${capability.maturity}`
              }))}
              layout="stack"
            />
          </section>
        </div>
      )}
    </>
  );

  if (hideTabs) {
    return panelBody;
  }

  return (
    <div className="workflow-support-panel workflow-support-panel--tabbed workflow-support-panel--extension" aria-label="拓展工具">
      <WorkflowSideTabs
        activeTab={activeTab}
        ariaLabel="拓展工具视图"
        onChange={setInternalTab}
        tabs={workflowExtensionTabs}
      />
      {panelBody}
    </div>
  );
}

import {
  actionItemStatusLabels,
  meetingMemoryKindLabels,
  participantRoleLabels,
  type MeetingAgentRun,
  type MeetingMemory,
  type MeetingRecord,
  type ProductNodeRun,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import {
  agentActionPriorityLabels,
  agentInsightKindLabels
} from "./workflowPanelUtils";

type WorkflowAuxStripProps = {
  agentError: string;
  agentRun: MeetingAgentRun | null;
  blockedNodeRun?: ProductNodeRun;
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
  isMemoryLoading: boolean;
  isMemoryMutating: boolean;
  isWorkflowActionBusy: boolean;
  meetingMemories: MeetingMemory[];
  memoryError: string;
  nextMeetingStatus: { label: string; value: MeetingRecord["status"] } | null;
  onAdvanceWorkflowRun: () => void;
  onCancelWorkflowRun: () => void;
  onConnectFeishuCalendar: () => void;
  onConnectGoogleCalendar: () => void;
  onDeleteMemory: (memoryId: string) => Promise<boolean>;
  onEditMeeting: () => void;
  onOpenDetail: () => void;
  onOpenRunDetail: () => void;
  onRetryWorkflowRun: () => void;
  onRunAgent: () => void;
  onStartWorkflowRun: () => void;
  onSyncFeishuCalendar: () => void;
  onSyncGoogleCalendar: () => void;
  onUpdateMemory: (
    memoryId: string,
    patch: Partial<Pick<MeetingMemory, "content" | "kind" | "visibility" | "isPinned">>
  ) => Promise<MeetingMemory | null>;
  onUpdateStatus: (status: MeetingRecord["status"]) => Promise<boolean>;
  resolutionNote: string;
  selectedFlowNodeId: string;
  selectedInputPayload: Array<{ key: string; value: string }>;
  selectedMeeting: MeetingRecord | null;
  selectedNode: { id: string; title: string } | null;
  selectedNodeRun?: ProductNodeRun;
  selectedOutputPayload: Array<{ key: string; value: string }>;
  selectedRun: ProductWorkflowRun | null;
  selectedTemplate: ProductWorkflowTemplate;
  setResolutionNote: (value: string) => void;
  setSelectedFlowNodeId: (nodeId: string) => void;
  workflowFeedback: string;
};

export function WorkflowAuxStrip(props: WorkflowAuxStripProps) {
  const {
    agentError,
    agentRun,
    blockedNodeRun,
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
    isMemoryLoading,
    isMemoryMutating,
    isWorkflowActionBusy,
    meetingMemories,
    memoryError,
    nextMeetingStatus,
    onAdvanceWorkflowRun,
    onCancelWorkflowRun,
    onConnectFeishuCalendar,
    onConnectGoogleCalendar,
    onDeleteMemory,
    onEditMeeting,
    onOpenDetail,
    onOpenRunDetail,
    onRetryWorkflowRun,
    onRunAgent,
    onStartWorkflowRun,
    onSyncFeishuCalendar,
    onSyncGoogleCalendar,
    onUpdateMemory,
    onUpdateStatus,
    resolutionNote,
    selectedMeeting,
    selectedNode,
    selectedRun,
    selectedTemplate,
    setResolutionNote,
    setSelectedFlowNodeId,
    workflowFeedback
  } = props;

  return (
    <div className="workflow-support-panel workflow-aux-strip" aria-label="流程辅助信息">
      {selectedMeeting && (
        <div className="ide-related" aria-label="会议议程预览">
          <section>
            <div className="ide-section-title">
              <strong>会议议程预览</strong>
              <span>{selectedMeeting.agendaItems.length} 项</span>
            </div>
            {selectedMeeting.agendaItems.map((item) => (
              <article className="ide-list-row" key={item.id}>
                <i className={item.completed ? "is-done" : ""} />
                <span>{item.title}</span>
                <small>{item.completed ? "已完成" : "待讨论"}</small>
              </article>
            ))}
          </section>

          <section>
            <div className="ide-section-title">
              <strong>参会人与待办</strong>
              <span>{selectedMeeting.participants.length} 人</span>
            </div>
            {selectedMeeting.participants.slice(0, 3).map((participant) => (
              <article className="ide-list-row" key={participant.id}>
                <b>{participant.name.slice(0, 1)}</b>
                <span>{participant.name}</span>
                <small>{participantRoleLabels[participant.role]}</small>
              </article>
            ))}
            {selectedMeeting.actionItems.slice(0, 3).map((item) => (
              <article className="ide-list-row ide-list-row--action" key={item.id}>
                <span>{item.content} / {item.owner} / {actionItemStatusLabels[item.status]}</span>
              </article>
            ))}
          </section>

          <section className="meeting-memory-strip" aria-label="会议长期记忆">
            <div className="ide-section-title">
              <strong>会议记忆</strong>
              <span>{isMemoryLoading ? "同步中" : `${meetingMemories.length} 条`}</span>
            </div>
            {memoryError ? <p className="memory-empty">{memoryError}</p> : null}
            {!memoryError && !isMemoryLoading && meetingMemories.length === 0 && (
              <p className="memory-empty">启动并完成一次流程后，会沉淀议程、待办和阻塞经验。</p>
            )}
            {meetingMemories.slice(0, 3).map((memory) => (
              <article className="ide-list-row memory-row" key={memory.id}>
                <div className="memory-row__body">
                  <span>{memory.content}</span>
                  <small>{memory.isPinned ? "已置顶 / " : ""}{meetingMemoryKindLabels[memory.kind]} / {memory.source}</small>
                </div>
                <div className="memory-row__actions">
                  <button className="memory-action-button" disabled={isMemoryMutating || isWorkflowActionBusy} onClick={() => void onUpdateMemory(memory.id, { isPinned: !memory.isPinned })} type="button">
                    {memory.isPinned ? "取消置顶" : "置顶"}
                  </button>
                  <button className="memory-action-button memory-action-button--danger" disabled={isMemoryMutating || isWorkflowActionBusy} onClick={() => void onDeleteMemory(memory.id)} type="button">
                    删除
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="meeting-agent-card" aria-label="内置会议 Agent">
            <div className="ide-section-title">
              <strong>工作流 Agent</strong>
              <span>{agentRun ? agentRun.model : "待运行"}</span>
            </div>
            {agentError ? <p className="memory-empty">{agentError}</p> : null}
            <p className="meeting-agent-card__summary">
              {agentRun?.summary ?? "运行 Agent 后，将自动选择匹配模板并执行会议工作流。"}
            </p>
            <button className="primary-button meeting-agent-card__button" disabled={!selectedMeeting || isWorkflowActionBusy} onClick={() => void onRunAgent()} type="button">
              {isAgentRunning ? "Agent 运行中" : "运行工作流 Agent"}
            </button>
            {agentRun && agentRun.actions.length > 0 && (
              <div className="meeting-agent-card__list">
                {agentRun.actions.slice(0, 3).map((action) => (
                  <article className={`meeting-agent-card__item priority-${action.priority}`} key={action.id}>
                    <span>{agentActionPriorityLabels[action.priority]}</span>
                    <strong>{action.title}</strong>
                    <p>{action.description}</p>
                  </article>
                ))}
              </div>
            )}
            {agentRun && agentRun.insights.length > 0 && (
              <div className="meeting-agent-card__insights">
                {agentRun.insights.slice(0, 2).map((insight) => (
                  <article key={insight.id}>
                    <span>{agentInsightKindLabels[insight.kind]}</span>
                    <strong>{insight.title}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {selectedMeeting && (
        <section className="calendar-integration-card" aria-label="会议日历接入">
          <div>
            <span>会议日历接入</span>
            <strong>Google Calendar / 飞书日历</strong>
            <p>{calendarStatusMessage || feishuCalendarStatusMessage || "同步会议时间、参会人和议程到外部日历。"}</p>
            {googleRedirectUri && <code>Google Redirect URI: {googleRedirectUri}</code>}
            {feishuRedirectUri && <code>Feishu Redirect URI: {feishuRedirectUri}</code>}
          </div>
          <div className="calendar-integration-card__actions">
            <button className="ghost-button" disabled={isWorkflowActionBusy || isCalendarLoading || !canSyncGoogleCalendar} onClick={() => void onSyncGoogleCalendar()} type="button">同步 Google</button>
            <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !canSyncFeishuCalendar} onClick={() => void onSyncFeishuCalendar()} type="button">同步飞书</button>
            <button className="ghost-button" disabled={isWorkflowActionBusy || isCalendarLoading || !isGoogleCalendarConfigured || isGoogleCalendarConnected} onClick={() => void onConnectGoogleCalendar()} type="button">连接 Google</button>
            <button className="ghost-button" disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !isFeishuCalendarConfigured || isFeishuCalendarConnected} onClick={() => void onConnectFeishuCalendar()} type="button">连接飞书</button>
          </div>
        </section>
      )}

      <div className="inspector-actions ide-actions" aria-label="流程操作">
        <div className="ide-actions__row">
          <button className="ghost-button" disabled={!selectedMeeting || isWorkflowActionBusy} onClick={onEditMeeting} type="button">编辑会议</button>
          {nextMeetingStatus && (
            <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onUpdateStatus(nextMeetingStatus.value)} type="button">
              {nextMeetingStatus.label}
            </button>
          )}
          <button className="ghost-button" disabled={!selectedNode || isWorkflowActionBusy} onClick={() => setSelectedFlowNodeId(selectedNode?.id ?? "")} type="button">定位当前节点</button>
          {selectedRun && (
            <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onRetryWorkflowRun()} type="button">重新运行</button>
          )}
          {selectedRun?.status === "running" && (
            <button className="danger-button" disabled={isWorkflowActionBusy} onClick={() => void onCancelWorkflowRun()} type="button">取消运行</button>
          )}
          <button className="ghost-button" disabled={!selectedMeeting} onClick={onOpenDetail} type="button">查看会议详情</button>
          <button className="ghost-button" disabled={!selectedRun} onClick={onOpenRunDetail} type="button">查看运行详情</button>
        </div>
        {blockedNodeRun && (
          <textarea
            aria-label="阻塞处理说明"
            onChange={(event) => setResolutionNote(event.target.value)}
            placeholder="记录阻塞处理说明"
            value={resolutionNote}
          />
        )}
        <button
          className="primary-button ide-actions__full"
          disabled={!selectedMeeting || !selectedTemplate || isWorkflowActionBusy}
          onClick={() => void (blockedNodeRun ? onAdvanceWorkflowRun() : onStartWorkflowRun())}
          type="button"
        >
          {blockedNodeRun ? "处理阻塞并继续" : "启动流程"}
        </button>
        {workflowFeedback && <p>{workflowFeedback}</p>}
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  actionItemStatusLabels,
  meetingMemoryKindLabels,
  type MeetingMemory,
  type MeetingRecord
} from "@meeting-flow/shared";
import { SelectableCardList } from "../common/SelectableCardList";
import { WorkflowSideTabs, workflowDetailTabs, type WorkflowDetailTab } from "./WorkflowSideTabs";

type WorkflowSupportPanelProps = {
  forcedTab?: WorkflowDetailTab;
  hideTabs?: boolean;
  isMemoryLoading: boolean;
  isMemoryMutating: boolean;
  isWorkflowActionBusy: boolean;
  meetingMemories: MeetingMemory[];
  memoryError: string;
  nextMeetingStatus: { label: string; value: MeetingRecord["status"] } | null;
  onDeleteMemory: (memoryId: string) => Promise<boolean>;
  onEditMeeting: () => void;
  onOpenDetail: () => void;
  readOnly?: boolean;
  onUpdateMemory: (
    memoryId: string,
    patch: Partial<Pick<MeetingMemory, "content" | "kind" | "visibility" | "isPinned">>
  ) => Promise<MeetingMemory | null>;
  onUpdateStatus: (status: MeetingRecord["status"]) => Promise<boolean>;
  selectedMeeting: MeetingRecord | null;
};

export function WorkflowSupportPanel(props: WorkflowSupportPanelProps) {
  const {
    forcedTab,
    hideTabs = false,
    isMemoryLoading,
    isMemoryMutating,
    isWorkflowActionBusy,
    meetingMemories,
    memoryError,
    nextMeetingStatus,
    onDeleteMemory,
    onEditMeeting,
    onOpenDetail,
    readOnly = false,
    onUpdateMemory,
    onUpdateStatus,
    selectedMeeting
  } = props;

  const [internalTab, setInternalTab] = useState<WorkflowDetailTab>("meeting");
  const activeTab = forcedTab ?? internalTab;

  const panelBody = (
    <>
      {activeTab === "meeting" && selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">当前会议</span>
            <strong>{selectedMeeting.title}</strong>
            <p>{selectedMeeting.host} · {selectedMeeting.attendeeCount} 人参会</p>
          </div>

          <section className="workflow-side-panel__section">
            <div className="ide-section-title">
              <strong>议程</strong>
              <span>{selectedMeeting.agendaItems.length} 项</span>
            </div>
            {selectedMeeting.agendaItems.length === 0 ? (
              <p className="memory-empty">暂无议程，可在会议详情中补充。</p>
            ) : (
              <SelectableCardList
                ariaLabel="议程"
                items={selectedMeeting.agendaItems.slice(0, 5).map((item) => ({
                  id: item.id,
                  title: item.title,
                  badge: item.completed ? "已完成" : "待讨论",
                  className: item.completed ? "is-done" : ""
                }))}
                layout="stack"
              />
            )}
          </section>

          <section className="workflow-side-panel__section">
            <div className="ide-section-title">
              <strong>待办</strong>
              <span>{selectedMeeting.actionItems.length} 项</span>
            </div>
            {selectedMeeting.actionItems.length === 0 ? (
              <p className="memory-empty">暂无待办事项。</p>
            ) : (
              <SelectableCardList
                ariaLabel="待办"
                items={selectedMeeting.actionItems.slice(0, 4).map((item) => ({
                  id: item.id,
                  title: item.content,
                  badge: actionItemStatusLabels[item.status],
                  className: "selectable-card--title-clamp"
                }))}
                layout="stack"
              />
            )}
          </section>

          <div className="workflow-side-panel__toolbar workflow-side-panel__toolbar--actions">
            {!readOnly ? (
              <>
                <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onEditMeeting} type="button">
                  编辑会议
                </button>
                {nextMeetingStatus && (
                  <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onUpdateStatus(nextMeetingStatus.value)} type="button">
                    {nextMeetingStatus.label}
                  </button>
                )}
              </>
            ) : null}
            <button className="ghost-button" onClick={onOpenDetail} type="button">
              查看详情
            </button>
          </div>
        </div>
      )}

      {activeTab === "meeting" && !selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <p className="memory-empty">请先从上方选择一场会议。</p>
        </div>
      )}

      {activeTab === "memory" && selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">会议记忆</span>
            <strong>{selectedMeeting.title}</strong>
            <p>{isMemoryLoading ? "同步中" : `${meetingMemories.length} 条经验记录`}</p>
          </div>

          <section className="meeting-memory-strip workflow-side-panel__section" aria-label="会议记忆">
            {memoryError ? <p className="memory-empty">{memoryError}</p> : null}
            <SelectableCardList
              ariaLabel="会议记忆"
              empty={
                !memoryError && meetingMemories.length === 0 && !isMemoryLoading ? (
                  <p className="memory-empty">完成一次流程后会自动沉淀经验。</p>
                ) : null
              }
              items={meetingMemories.map((memory) => ({
                id: memory.id,
                title: memory.content,
                badge: meetingMemoryKindLabels[memory.kind],
                className: [
                  "selectable-card--title-clamp",
                  memory.isPinned ? "is-pinned" : ""
                ]
                  .filter(Boolean)
                  .join(" "),
                actions: !readOnly ? (
                  <>
                    <button
                      className="memory-action-button"
                      disabled={isMemoryMutating || isWorkflowActionBusy}
                      onClick={() => void onUpdateMemory(memory.id, { isPinned: !memory.isPinned })}
                      type="button"
                    >
                      {memory.isPinned ? "取消置顶" : "置顶"}
                    </button>
                    <button
                      className="memory-action-button memory-action-button--danger"
                      disabled={isMemoryMutating || isWorkflowActionBusy}
                      onClick={() => void onDeleteMemory(memory.id)}
                      type="button"
                    >
                      删除
                    </button>
                  </>
                ) : undefined
              }))}
              layout="stack"
            />
          </section>
        </div>
      )}

      {activeTab === "memory" && !selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <p className="memory-empty">请先从上方选择一场会议。</p>
        </div>
      )}
    </>
  );

  if (hideTabs) {
    return panelBody;
  }

  return (
    <div className="workflow-support-panel workflow-support-panel--tabbed" aria-label="流程侧栏">
      <WorkflowSideTabs activeTab={activeTab} ariaLabel="详情面板视图" onChange={setInternalTab} tabs={workflowDetailTabs} />
      {panelBody}
    </div>
  );
}

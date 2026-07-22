import {
  actionItemStatusLabels,
  meetingStatusLabels,
  type MeetingRecord,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import { formatDateRange } from "../../lib/format";
import type { WorkbenchView } from "../../contexts/WorkbenchContext";
import { getRunNode, runStatusLabels } from "../workflow/workflowPanelUtils";
import { MeetingBrowser, type MeetingBrowserProps } from "../meetings/MeetingBrowser";
import { SelectableCardList } from "../common/SelectableCardList";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";

type MeetingOverviewProps = {
  browser: MeetingBrowserProps;
  hint?: string | null;
  isBusy?: boolean;
  latestRun: ProductWorkflowRun | null;
  meeting: MeetingRecord | null;
  nextMeetingStatus?: { label: string; value: MeetingRecord["status"] } | null;
  onEditMeeting?: () => void;
  onNavigate: (view: WorkbenchView) => void;
  onOpenDetail: () => void;
  onUpdateStatus?: (status: MeetingRecord["status"]) => Promise<boolean>;
  readOnly?: boolean;
  templates: ProductWorkflowTemplate[];
};

export function MeetingOverview({
  browser,
  hint,
  isBusy = false,
  latestRun,
  meeting,
  nextMeetingStatus = null,
  onEditMeeting,
  onNavigate,
  onOpenDetail,
  onUpdateStatus,
  readOnly = true,
  templates
}: MeetingOverviewProps) {
  const discussedCount = meeting ? meeting.agendaItems.filter((item) => item.completed).length : 0;
  const openActionCount = meeting ? meeting.actionItems.filter((item) => item.status !== "completed").length : 0;
  const activeNodeRun = latestRun?.nodeRuns.find((nodeRun) => nodeRun.status === "running" || nodeRun.status === "blocked");
  const activeTemplate = latestRun ? templates.find((template) => template.id === latestRun.templateId) ?? null : null;
  const activeNodeTitle = activeNodeRun && activeTemplate
    ? getRunNode(activeTemplate, activeNodeRun.nodeId)?.title
    : undefined;
  const flowLabel = latestRun ? runStatusLabels[latestRun.status] : "未启动";
  const flowHint = activeNodeTitle
    ? `当前节点：${activeNodeTitle}`
    : latestRun
      ? "可在流程页查看详情"
      : "等待启动";

  return (
    <MeetingWorkspaceLayout hint={hint}>
      <section className="meeting-overview" aria-label="会议概览">
        <MeetingBrowser {...browser} />

        {meeting ? (
          <>
            <header className="meeting-overview__header">
              <div className="meeting-overview__header-copy">
                <strong>{meeting.title}</strong>
                <p>
                  {meeting.host} · {formatDateRange(meeting.startAt, meeting.endAt)} · {meeting.attendeeCount} 人
                </p>
              </div>
              <div className="meeting-overview__header-actions">
                <span className={`status-badge status-badge--${meeting.status}`}>
                  {meetingStatusLabels[meeting.status]}
                </span>
                {!readOnly && onEditMeeting ? (
                  <button className="ghost-button" disabled={isBusy} onClick={onEditMeeting} type="button">
                    编辑会议
                  </button>
                ) : null}
                {!readOnly && nextMeetingStatus && onUpdateStatus ? (
                  <button
                    className="ghost-button"
                    disabled={isBusy}
                    onClick={() => void onUpdateStatus(nextMeetingStatus.value)}
                    type="button"
                  >
                    {nextMeetingStatus.label}
                  </button>
                ) : null}
                <button className="ghost-button" onClick={onOpenDetail} type="button">
                  查看详情
                </button>
              </div>
            </header>

            <div className="meeting-overview__meta" aria-label="会议指标">
              <span>
                议程 <strong>{discussedCount}/{meeting.agendaItems.length || 0}</strong>
              </span>
              <span>
                待办 <strong>{openActionCount}</strong>
              </span>
              <span title={flowHint}>
                流程 <strong>{flowLabel}</strong>
              </span>
            </div>

            <div className="meeting-overview__body">
              <section className="meeting-overview__section" aria-label="今日议程">
                <div className="meeting-overview__section-title">
                  <strong>议程</strong>
                  <span>{meeting.agendaItems.length} 项</span>
                </div>
                {meeting.agendaItems.length === 0 ? (
                  <p className="meeting-overview__empty">暂无议程，可在会议详情中补充。</p>
                ) : (
                  <SelectableCardList
                    ariaLabel="议程"
                    className="meeting-overview__card-list"
                    items={meeting.agendaItems.map((item) => ({
                      id: item.id,
                      title: item.title,
                      badge: item.completed ? "已完成" : "待讨论",
                      className: item.completed ? "is-done" : ""
                    }))}
                    layout="stack"
                  />
                )}
              </section>

              <section className="meeting-overview__section" aria-label="跟进事项">
                <div className="meeting-overview__section-title">
                  <strong>待办</strong>
                  <span>{meeting.actionItems.length} 项</span>
                </div>
                {meeting.actionItems.length === 0 ? (
                  <p className="meeting-overview__empty">暂无待办事项。</p>
                ) : (
                  <SelectableCardList
                    ariaLabel="待办"
                    className="meeting-overview__card-list"
                    items={meeting.actionItems.slice(0, 8).map((item) => ({
                      id: item.id,
                      title: item.content,
                      badge: actionItemStatusLabels[item.status],
                      className: "selectable-card--title-clamp"
                    }))}
                    layout="stack"
                  />
                )}
              </section>
            </div>

            <footer className="meeting-overview__footer">
              <button className="ghost-button" onClick={() => onNavigate("chat")} type="button">
                进入对话
              </button>
              <button className="ghost-button" onClick={() => onNavigate("workspace")} type="button">
                打开流程
              </button>
              <button className="ghost-button" onClick={() => onNavigate("knowledge")} type="button">
                知识库
              </button>
            </footer>
          </>
        ) : (
          <section className="meeting-overview__hint" aria-label="选择提示">
            <h2>选择一场会议</h2>
            <p>在上方卡片中对比状态与时间，或通过顶栏选择器快速切换。</p>
          </section>
        )}
      </section>
    </MeetingWorkspaceLayout>
  );
}

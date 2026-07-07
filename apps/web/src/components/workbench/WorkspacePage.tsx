import { meetingStatusLabels } from "@meeting-flow/shared";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { StatusBannerGroup } from "../common/StatusBannerGroup";
import { MeetingListPanel } from "../meetings/MeetingListPanel";
import { WorkflowTemplatePanel } from "../workflow/WorkflowTemplatePanel";

export function WorkspacePage() {
  const {
    agent,
    derived,
    feishuCalendar,
    googleCalendar,
    meetings,
    memories,
    modals,
    workflow
  } = useWorkbench();

  const blockedRunCount = workflow.runs.filter(
    (run) => run.status === "blocked" || run.nodeRuns.some((nodeRun) => nodeRun.status === "blocked")
  ).length;
  const subtitle = meetings.selectedMeeting
    ? `${meetingStatusLabels[meetings.selectedMeeting.status]} · ${meetings.selectedMeeting.host} · ${meetings.selectedMeeting.attendeeCount} 人`
    : "从左侧选择会议，在画布中运行流程";

  return (
    <>
      <section className="workbench-commandbar workbench-commandbar--compact workbench-commandbar--focused" aria-label="工作台操作">
        <div className="workbench-commandbar__lead">
          <span className="section-kicker">Workspace</span>
          <h1>{meetings.selectedMeeting?.title ?? "会议流程工作台"}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="workbench-commandbar__meta" aria-label="工作台概览">
          <span>{meetings.filteredMeetings.length} 场会议</span>
          <span>{derived.todayMeetingCount} 场今日</span>
          {blockedRunCount > 0 && <span className="workbench-commandbar__alert">{blockedRunCount} 个阻塞</span>}
        </div>
        <button className="primary-button" onClick={modals.openCreate} type="button">
          新建会议
        </button>
      </section>

      <section className="workbench-console workbench-console--simple" id="workflow-console">
        <StatusBannerGroup
          items={[
            { id: "meetings", error: meetings.error, feedback: meetings.feedback },
            { id: "google-calendar", error: googleCalendar.error, feedback: googleCalendar.feedback },
            { id: "feishu-calendar", error: feishuCalendar.error, feedback: feishuCalendar.feedback },
            { id: "workflow", error: workflow.error, feedback: workflow.feedback },
            { id: "memory", error: memories.error, feedback: "" },
            { id: "agent", error: agent.error, feedback: "" }
          ]}
        />

        <div className="workbench-grid workbench-grid--simplified" id="meetings">
          <MeetingListPanel
            dateFilter={meetings.dateFilter}
            isLoading={meetings.isLoading}
            meetings={meetings.filteredMeetings}
            organizerFilter={meetings.organizerFilter}
            organizerOptions={meetings.organizerOptions}
            searchQuery={meetings.searchQuery}
            selectedMeetingId={meetings.selectedMeetingId}
            sortBy={meetings.sortBy}
            statusFilter={meetings.statusFilter}
            typeFilter={meetings.typeFilter}
            onDateFilterChange={meetings.setDateFilter}
            onOrganizerFilterChange={meetings.setOrganizerFilter}
            onSearchChange={meetings.setSearchQuery}
            onSelectMeeting={meetings.setSelectedMeetingId}
            onSortByChange={meetings.setSortBy}
            onStatusFilterChange={meetings.setStatusFilter}
            onTypeFilterChange={meetings.setTypeFilter}
          />

          {meetings.selectedMeeting ? (
            <WorkflowTemplatePanel />
          ) : (
            <section className="workbench-empty" aria-label="入门指南">
              <div className="workbench-empty__icon" aria-hidden="true" />
              <h2>选择会议开始</h2>
              <p>
                {meetings.filteredMeetings.length > 0
                  ? "选中左侧会议后，右侧会展示流程画布与运行侧栏。"
                  : "还没有会议，先创建一场会议。"}
              </p>
              {meetings.filteredMeetings.length === 0 && (
                <button className="primary-button" onClick={modals.openCreate} type="button">
                  新建会议
                </button>
              )}
            </section>
          )}
        </div>
      </section>
    </>
  );
}

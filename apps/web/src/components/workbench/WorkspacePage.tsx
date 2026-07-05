import { meetingStatusLabels } from "@meeting-flow/shared";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { StatusBanner } from "../common/StatusBanner";
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
  const currentMeetingText = meetings.selectedMeeting
    ? `${meetingStatusLabels[meetings.selectedMeeting.status]} / ${meetings.selectedMeeting.host} / ${meetings.selectedMeeting.attendeeCount} 人`
    : "选择会议后运行流程";

  return (
    <>
      <section className="workbench-commandbar workbench-commandbar--compact" aria-label="工作台操作">
        <div>
          <span className="section-kicker">Workspace</span>
          <h1>{meetings.selectedMeeting?.title ?? "会议流程工作台"}</h1>
          <p>{currentMeetingText}</p>
        </div>
        <div className="workspace-quick-stats" aria-label="工作台概览">
          <span>{meetings.filteredMeetings.length} 场筛选结果</span>
          <span>{derived.todayMeetingCount} 场今日会议</span>
          <span>{blockedRunCount} 个阻塞流程</span>
        </div>
        <button className="primary-button" onClick={modals.openCreate} type="button">
          新建会议
        </button>
      </section>

      <section className="workbench-console workbench-console--simple" id="workflow-console">
        <StatusBanner error={meetings.error} feedback={meetings.feedback} />
        <StatusBanner error={googleCalendar.error} feedback={googleCalendar.feedback} />
        <StatusBanner error={feishuCalendar.error} feedback={feishuCalendar.feedback} />

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
            <WorkflowTemplatePanel
              agentError={agent.error}
              agentRun={agent.agentRun}
              calendarStatusMessage={googleCalendar.statusMessage}
              feishuCalendarStatusMessage={feishuCalendar.statusMessage}
              feishuRedirectUri={feishuCalendar.redirectUri}
              googleRedirectUri={googleCalendar.redirectUri}
              isAgentRunning={agent.isRunning}
              isCalendarLoading={googleCalendar.isLoading}
              isCalendarMutating={googleCalendar.isMutating}
              isFeishuCalendarConnected={feishuCalendar.isConnected}
              isFeishuCalendarConfigured={feishuCalendar.isConfigured}
              isFeishuCalendarLoading={feishuCalendar.isLoading}
              isFeishuCalendarMutating={feishuCalendar.isMutating}
              isGoogleCalendarConnected={googleCalendar.isConnected}
              isGoogleCalendarConfigured={googleCalendar.isConfigured}
              isMemoryLoading={memories.isLoading}
              isMemoryMutating={memories.isMutating}
              isMutating={meetings.isMutating}
              isWorkflowLoading={workflow.isLoading}
              isWorkflowMutating={workflow.isMutating}
              meetingMemories={memories.items}
              memoryError={memories.error}
              selectedMeeting={meetings.selectedMeeting}
              workflowError={workflow.error}
              workflowFeedback={workflow.feedback}
              workflowRuns={workflow.runs}
              workflowTemplates={workflow.templates}
              onAdvanceWorkflowRun={workflow.advanceRunAndReloadMemories}
              onCancelWorkflowRun={workflow.cancelWorkflowRun}
              onConnectFeishuCalendar={feishuCalendar.connectFeishuCalendar}
              onConnectGoogleCalendar={googleCalendar.connectGoogleCalendar}
              onDeleteMemory={memories.deleteMemory}
              onEditMeeting={() => modals.openEdit(meetings.selectedMeeting!.id)}
              onOpenDetail={() => modals.openDetail(meetings.selectedMeeting!.id)}
              onRetryWorkflowRun={workflow.retryRunAndReloadMemories}
              onRunAgent={agent.runAgentAndReload}
              onSaveTemplateCanvas={workflow.saveTemplateCanvas}
              onStartWorkflowRun={workflow.startRunForSelectedMeeting}
              onSyncFeishuCalendar={() => feishuCalendar.syncMeeting(meetings.selectedMeeting!.id)}
              onSyncGoogleCalendar={() => googleCalendar.syncMeeting(meetings.selectedMeeting!.id)}
              onUpdateMemory={memories.updateMemory}
              onUpdateStatus={meetings.updateMeetingStatus}
            />
          ) : (
            <section className="workbench-empty" aria-label="入门指南">
              <div className="workbench-empty__icon" aria-hidden="true" />
              <h2>选择会议开始编排流程</h2>
              <p>
                {meetings.filteredMeetings.length > 0
                  ? "从左侧列表选择一场会议，即可查看和编排它的工作流模板、运行记录和待办事项。"
                  : "还没有会议。点击上方“新建会议”创建第一场会议。"}
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

import { WorkflowMorePanel } from "../workflow/WorkflowMorePanel";
import type { WorkflowSidePanelTab } from "../workflow/WorkflowSideTabs";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { useMeetingSidePanelProps } from "../../hooks/useMeetingSidePanelProps";
import { MeetingAgentPage } from "./MeetingAgentPage";
import { MeetingMemoriesPage } from "./MeetingMemoriesPage";
import { MeetingOverview } from "./MeetingOverview";
import { MeetingSchedulesPage } from "./MeetingSchedulesPage";
import { WorkbenchConfigPage } from "./WorkbenchConfigPage";
import { MeetingReadOnlyBanner } from "./layout/MeetingReadOnlyBanner";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";
import { isMeetingReadOnly } from "./layout/navAccess";

type MeetingSidePanelPageProps = {
  tab: WorkflowSidePanelTab;
};

export function MeetingSidePanelPage({ tab }: MeetingSidePanelPageProps) {
  const { setWorkbenchView, workflow, memories, meetings, derived } = useWorkbench();
  const { hint, more, support } = useMeetingSidePanelProps();
  const readOnly = isMeetingReadOnly(support.selectedMeeting);

  if (tab === "meeting") {
    const latestRun = support.selectedMeeting
      ? workflow.runs
        .filter((run) => run.meetingId === support.selectedMeeting?.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null
      : null;

    return (
      <MeetingOverview
        browser={{
          dateFilter: meetings.dateFilter,
          isLoading: meetings.isLoading,
          meetings: meetings.filteredMeetings,
          organizerFilter: meetings.organizerFilter,
          organizerOptions: meetings.organizerOptions,
          searchQuery: meetings.searchQuery,
          selectedMeetingId: meetings.selectedMeetingId,
          sortBy: meetings.sortBy,
          statusFilter: meetings.statusFilter,
          typeFilter: meetings.typeFilter,
          onDateFilterChange: meetings.setDateFilter,
          onOrganizerFilterChange: meetings.setOrganizerFilter,
          onSearchChange: meetings.setSearchQuery,
          onSelectMeeting: meetings.setSelectedMeetingId,
          onSortByChange: meetings.setSortBy,
          onStatusFilterChange: meetings.setStatusFilter,
          onTypeFilterChange: meetings.setTypeFilter
        }}
        hint={hint}
        isBusy={support.isWorkflowActionBusy}
        latestRun={latestRun}
        meeting={support.selectedMeeting}
        nextMeetingStatus={support.nextMeetingStatus}
        onEditMeeting={support.onEditMeeting}
        onNavigate={setWorkbenchView}
        onOpenDetail={support.onOpenDetail}
        onUpdateStatus={support.onUpdateStatus}
        readOnly={readOnly}
        templates={workflow.templates}
      />
    );
  }

  if (tab === "memory") {
    return (
      <MeetingMemoriesPage
        hint={hint}
        isBusy={support.isWorkflowActionBusy}
        isLoading={memories.isLoading}
        isMutating={memories.isMutating}
        meeting={support.selectedMeeting}
        memories={memories.items}
        memoryError={memories.error}
        onDeleteMemory={memories.deleteMemory}
        onCreateMemory={memories.createMemory}
        onReload={() => void memories.reloadMemories()}
        onUpdateMemory={memories.updateMemory}
        readOnly={readOnly}
      />
    );
  }

  if (tab === "agent") {
    return (
      <MeetingAgentPage
        agentActionFeedback={more.agentActionFeedback}
        agentError={more.agentError}
        agentRun={more.agentRun}
        hint={hint}
        isAgentRunning={more.isAgentRunning}
        isBusy={more.isWorkflowActionBusy}
        meeting={support.selectedMeeting}
        onExecuteAgentAction={more.onExecuteAgentAction}
        onRunAgent={more.onRunAgent}
        readOnly={readOnly}
        runtimeLabel={derived.modelRuntimeLabel}
      />
    );
  }

  if (tab === "config") {
    return (
      <WorkbenchConfigPage
        canSyncFeishuCalendar={more.canSyncFeishuCalendar}
        feishuCalendarStatusMessage={more.feishuCalendarStatusMessage}
        feishuRedirectUri={more.feishuRedirectUri}
        hint={hint}
        isBusy={more.isWorkflowActionBusy}
        isFeishuCalendarConfigured={more.isFeishuCalendarConfigured}
        isFeishuCalendarConnected={more.isFeishuCalendarConnected}
        isFeishuCalendarLoading={more.isFeishuCalendarLoading}
        meeting={support.selectedMeeting}
        onConnectFeishuCalendar={more.onConnectFeishuCalendar}
        onRefreshFeishuMeeting={more.onRefreshFeishuMeeting}
        onSyncFeishuCalendar={more.onSyncFeishuCalendar}
        readOnly={readOnly}
      />
    );
  }

  if (tab === "schedules") {
    return (
      <MeetingSchedulesPage
        hint={hint}
        isBusy={more.isWorkflowActionBusy}
        meeting={support.selectedMeeting}
        readOnly={readOnly}
        workflowTemplates={workflow.templates}
      />
    );
  }

  return (
    <MeetingWorkspaceLayout hint={hint}>
      <section className="workbench-side-page" aria-label={tab}>
        <MeetingReadOnlyBanner meeting={support.selectedMeeting} />
        <div className="workbench-side-page__panel">
          <WorkflowMorePanel {...more} forcedTab={tab} hideTabs />
        </div>
      </section>
    </MeetingWorkspaceLayout>
  );
}

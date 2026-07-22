import { useAuth } from "../../../contexts/AuthContext";
import { useWorkbench } from "../../../contexts/WorkbenchContext";
import { MeetingSelectorBar } from "../../meetings/MeetingSelectorBar";
import { canCreateMeeting, canManageMeetingAppConnections, canOpenRunsConsole, getProductRole } from "./navAccess";
import { isMeetingWorkbenchView } from "./viewMeta";

export function MeetingHeaderActions() {
  const { user } = useAuth();
  const {
    feishuCalendar,
    meetings,
    modals,
    openRunsConsole,
    setWorkbenchView,
    workflow,
    workbenchView
  } = useWorkbench();

  if (!user || !isMeetingWorkbenchView(workbenchView)) {
    return null;
  }

  const blockedRunCount = workflow.runs.filter(
    (run) => run.status === "blocked" || run.nodeRuns.some((nodeRun) => nodeRun.status === "blocked")
  ).length;
  const productRole = getProductRole(user);
  const showBlockedAlert = canOpenRunsConsole(productRole) && workbenchView === "workspace" && blockedRunCount > 0;
  const canConnect = canManageMeetingAppConnections(productRole);
  const ready = feishuCalendar.isConfigured && feishuCalendar.isConnected;
  const needsConnect = canConnect && feishuCalendar.isConfigured && !ready;

  const connectionAction = canConnect ? (
    <button
      className={`meeting-selector__connection${needsConnect ? " is-attention" : ready ? " is-ready" : ""}`}
      data-testid="header-meeting-connection"
      onClick={() => setWorkbenchView("config")}
      type="button"
      title={needsConnect ? "待连接飞书" : ready ? "飞书已连接" : "飞书未配置"}
    >
      {needsConnect ? "待连接" : ready ? "飞书已连接" : "未配置"}
    </button>
  ) : null;

  return (
    <MeetingSelectorBar
      actions={(
        <>
          {connectionAction}
          {showBlockedAlert ? (
            <button
              className="workbench-page__alert"
              onClick={() => openRunsConsole({ status: "blocked" })}
              type="button"
            >
              {blockedRunCount} 阻塞
            </button>
          ) : null}
        </>
      )}
      isLoading={meetings.isLoading}
      meetings={meetings.filteredMeetings}
      searchQuery={meetings.searchQuery}
      selectedMeeting={meetings.selectedMeeting}
      selectedMeetingId={meetings.selectedMeetingId}
      showCreateButton={canCreateMeeting(productRole)}
      onCreateMeeting={modals.openCreate}
      onSearchChange={meetings.setSearchQuery}
      onSelectMeeting={meetings.setSelectedMeetingId}
    />
  );
}

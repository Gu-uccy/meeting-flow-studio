import { useWorkbench } from "../contexts/WorkbenchContext";
import { getNextMeetingStatus } from "../components/workflow/workflowPanelUtils";
import { isMeetingReadOnly } from "../components/workbench/layout/navAccess";

export function useMeetingSidePanelProps() {
  const {
    agent,
    feishuCalendar,
    meetings,
    memories,
    modals,
    workflow
  } = useWorkbench();

  const selectedMeeting = meetings.selectedMeeting;
  const isReadOnly = isMeetingReadOnly(selectedMeeting);
  const isMutating = meetings.isMutating;
  const isWorkflowMutating = workflow.isMutating;
  const isFeishuCalendarMutating = feishuCalendar.isMutating;
  const isAgentRunning = agent.isRunning;
  const isWorkflowActionBusy = isMutating || isWorkflowMutating || isFeishuCalendarMutating || isAgentRunning;
  const nextMeetingStatus = selectedMeeting ? getNextMeetingStatus(selectedMeeting.status) : null;
  const canSyncFeishuCalendar = feishuCalendar.isConfigured && feishuCalendar.isConnected;

  const onOpenDetail = () => {
    if (selectedMeeting) {
      modals.openDetail(selectedMeeting.id);
    }
  };

  const onEditMeeting = () => {
    if (selectedMeeting && !isReadOnly) {
      modals.openEdit(selectedMeeting.id);
    }
  };

  const onSyncFeishuCalendar = () => (
    selectedMeeting ? feishuCalendar.syncMeeting(selectedMeeting.id) : Promise.resolve(null)
  );

  const onRefreshFeishuMeeting = () => (
    selectedMeeting ? feishuCalendar.refreshMeetingRecording(selectedMeeting.id) : Promise.resolve(null)
  );

  return {
    hint: meetings.error || workflow.error || memories.error || agent.error || meetings.feedback || workflow.feedback,
    meetings,
    modals,
    more: {
      agentActionFeedback: agent.actionFeedback,
      agentError: agent.error,
      agentRun: agent.agentRun,
      canSyncFeishuCalendar,
      feishuCalendarStatusMessage: feishuCalendar.statusMessage,
      feishuRedirectUri: feishuCalendar.redirectUri,
      isAgentRunning,
      isFeishuCalendarConfigured: feishuCalendar.isConfigured,
      isFeishuCalendarConnected: feishuCalendar.isConnected,
      isFeishuCalendarLoading: feishuCalendar.isLoading,
      isWorkflowActionBusy,
      onConnectFeishuCalendar: () => void feishuCalendar.connectFeishuCalendar(),
      onExecuteAgentAction: (action: Parameters<typeof agent.executeAgentAction>[0]) => void agent.executeAgentAction(action),
      onRefreshFeishuMeeting: () => void onRefreshFeishuMeeting(),
      onRunAgent: () => void agent.runAgentAndReload(),
      onSyncFeishuCalendar: () => void onSyncFeishuCalendar(),
      readOnly: isReadOnly,
      selectedMeeting,
      workflowTemplates: workflow.templates
    },
    support: {
      isMemoryLoading: memories.isLoading,
      isMemoryMutating: memories.isMutating,
      isWorkflowActionBusy,
      meetingMemories: memories.items,
      memoryError: memories.error,
      nextMeetingStatus,
      onDeleteMemory: memories.deleteMemory,
      onEditMeeting,
      onOpenDetail,
      readOnly: isReadOnly,
      onUpdateMemory: memories.updateMemory,
      onUpdateStatus: meetings.updateMeetingStatus,
      selectedMeeting
    }
  };
}

import type { MeetingRecordWithPermissions } from "@meeting-flow/shared";
import type { useMeetingChat } from "../../hooks/useMeetingChat";
import { isMeetingReadOnly } from "../workbench/layout/navAccess";
import { MeetingChatView } from "../workbench/chat/MeetingChatView";

type WorkflowChatPanelProps = {
  chat: ReturnType<typeof useMeetingChat>;
  isWorkflowActionBusy: boolean;
  selectedMeeting: MeetingRecordWithPermissions | null;
};

export function WorkflowChatPanel({ chat, isWorkflowActionBusy, selectedMeeting }: WorkflowChatPanelProps) {
  if (!selectedMeeting) {
    return <p className="chat-page__empty">请先从上方选择一场会议。</p>;
  }

  return (
    <MeetingChatView
      canClearChat={!isMeetingReadOnly(selectedMeeting)}
      chat={chat}
      isWorkflowActionBusy={isWorkflowActionBusy}
      selectedMeeting={selectedMeeting}
    />
  );
}

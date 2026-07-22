import type { MeetingRecordWithPermissions } from "@meeting-flow/shared";
import { isMeetingReadOnly } from "../workbench/layout/navAccess";
import { MeetingKnowledgeView } from "../workbench/knowledge/MeetingKnowledgeView";

type WorkflowKnowledgePanelProps = {
  isWorkflowActionBusy: boolean;
  selectedMeeting: MeetingRecordWithPermissions | null;
};

export function WorkflowKnowledgePanel({ isWorkflowActionBusy, selectedMeeting }: WorkflowKnowledgePanelProps) {
  if (!selectedMeeting) {
    return <p className="knowledge-page__empty">请先从上方选择一场会议。</p>;
  }

  return (
    <MeetingKnowledgeView
      isWorkflowActionBusy={isWorkflowActionBusy}
      readOnly={isMeetingReadOnly(selectedMeeting)}
      selectedMeeting={selectedMeeting}
    />
  );
}

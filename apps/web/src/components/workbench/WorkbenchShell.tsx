import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { Modal } from "../common/Modal";
import { MeetingCreateForm } from "../meetings/MeetingCreateForm";
import { MeetingDetailPanel } from "../meetings/MeetingDetailPanel";
import { AccountPage } from "./AccountPage";
import { ChatPage } from "./ChatPage";
import { KnowledgePage } from "./KnowledgePage";
import { MeetingSidePanelPage } from "./MeetingSidePanelPage";
import { NodeAgentPage } from "./NodeAgentPage";
import { RunsConsolePage } from "./RunsConsolePage";
import { WorkspacePage } from "./WorkspacePage";
import { AppLayout } from "./layout/AppLayout";
import { MeetingHeaderActions } from "./layout/MeetingHeaderActions";
import { resolveMeetingSidePanelTab } from "./layout/viewMeta";

type WorkbenchShellProps = {
  onLogout: () => void;
};

export function WorkbenchShell({ onLogout }: WorkbenchShellProps) {
  const { user } = useAuth();
  const { workbenchView, meetings, modals } = useWorkbench();

  if (!user) {
    return null;
  }

  const meetingSidePanelTab = resolveMeetingSidePanelTab(workbenchView);

  return (
    <>
      <AppLayout headerActions={<MeetingHeaderActions />} onLogout={onLogout} userName={user.name} view={workbenchView}>
        {workbenchView === "workspace" && <WorkspacePage />}
        {meetingSidePanelTab ? <MeetingSidePanelPage tab={meetingSidePanelTab} /> : null}
        {workbenchView === "chat" && <ChatPage />}
        {workbenchView === "knowledge" && <KnowledgePage />}
        {workbenchView === "runs" && <RunsConsolePage />}
        {workbenchView === "apps" && <NodeAgentPage />}
        {workbenchView === "account" && <AccountPage />}
      </AppLayout>

      {modals.isCreateOpen && (
        <Modal onClose={modals.closeCreate} size="xl" title="新建会议流程">
          <MeetingCreateForm
            formState={meetings.formState}
            isSubmitting={meetings.isSubmitting}
            onAddAgendaItem={meetings.addFormAgendaItem}
            onAddParticipant={meetings.addFormParticipant}
            onAgendaItemChange={meetings.updateFormAgendaItem}
            onFieldChange={meetings.handleFieldChange}
            onParticipantChange={meetings.updateFormParticipant}
            onRemoveAgendaItem={meetings.removeFormAgendaItem}
            onRemoveParticipant={meetings.removeFormParticipant}
            onSubmit={modals.submitCreate}
          />
        </Modal>
      )}

      {modals.isDetailOpen && meetings.selectedMeeting && meetings.selectedMeetingEditable && (
        <Modal
          onClose={modals.closeDetail}
          size="lg"
          title={modals.isDetailEditing ? "编辑会议" : meetings.selectedMeeting.title}
        >
          <MeetingDetailPanel
            editableMeeting={meetings.selectedMeetingEditable}
            isEditing={modals.isDetailEditing}
            isMutating={meetings.isMutating}
            meeting={meetings.selectedMeeting}
            onCancelMeeting={meetings.cancelMeeting}
            onDeleteMeeting={modals.deleteSelectedMeeting}
            onEditingChange={modals.setDetailEditing}
            onSaveMeeting={meetings.saveMeetingEdits}
            onUpdateStatus={meetings.updateMeetingStatus}
          />
        </Modal>
      )}
    </>
  );
}

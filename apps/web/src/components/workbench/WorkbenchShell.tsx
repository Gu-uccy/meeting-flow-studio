import { meetingFlowProduct } from "@meeting-flow/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { BrandMark } from "../common/BrandMark";
import { Modal } from "../common/Modal";
import { MeetingCreateForm } from "../meetings/MeetingCreateForm";
import { MeetingDetailPanel } from "../meetings/MeetingDetailPanel";
import { AccountPage } from "./AccountPage";
import { NodeAgentPage } from "./NodeAgentPage";
import { WorkspacePage } from "./WorkspacePage";

type WorkbenchShellProps = {
  onLogout: () => void;
};

export function WorkbenchShell({ onLogout }: WorkbenchShellProps) {
  const { user } = useAuth();
  const { workbenchView, setWorkbenchView, meetings, modals } = useWorkbench();

  if (!user) {
    return null;
  }

  return (
    <div className="retool-shell workbench-shell">
      <header className="workbench-nav">
        <div className="workbench-nav__brand" aria-label={meetingFlowProduct.name}>
          <BrandMark />
          <span>
            <strong>{meetingFlowProduct.name}</strong>
            <small>会议流程工作台</small>
          </span>
        </div>
        <div className="nav-view-switch" aria-label="主视图切换">
          <button
            className={`nav-view-switch__button ${workbenchView === "workspace" ? "is-active" : ""}`}
            onClick={() => setWorkbenchView("workspace")}
            type="button"
          >
            会议流程管理
          </button>
          <button
            className={`nav-view-switch__button ${workbenchView === "apps" ? "is-active" : ""}`}
            onClick={() => setWorkbenchView("apps")}
            type="button"
          >
            节点智能体管理
          </button>
        </div>
        <div className="nav-actions">
          <button
            className={`nav-account ${workbenchView === "account" ? "is-active" : ""}`}
            onClick={() => setWorkbenchView("account")}
            type="button"
          >
            {user.name}
          </button>
          <span className="nav-divider" aria-hidden="true">|</span>
          <button className="nav-logout" onClick={onLogout} type="button">
            退出
          </button>
        </div>
      </header>

      <main
        className={`workbench-main ${workbenchView === "account" ? "workbench-main--account" : workbenchView === "apps" ? "workbench-main--apps" : ""}`}
        id="workbench"
      >
        {workbenchView === "account" && <AccountPage />}
        {workbenchView === "workspace" && <WorkspacePage />}
        {workbenchView === "apps" && <NodeAgentPage />}
      </main>

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
    </div>
  );
}

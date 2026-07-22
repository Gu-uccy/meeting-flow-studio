import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { canCreateMeeting, getProductRole, isMeetingReadOnly } from "./layout/navAccess";
import { MeetingKnowledgeView } from "./knowledge/MeetingKnowledgeView";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";

export function KnowledgePage() {
  const { user } = useAuth();
  const { meetings, modals, workflow } = useWorkbench();
  const canCreate = user ? canCreateMeeting(getProductRole(user)) : false;
  const isWorkflowActionBusy = meetings.isMutating || workflow.isMutating;
  return (
    <MeetingWorkspaceLayout hint={meetings.error || workflow.error} id="meeting-knowledge">
      {meetings.selectedMeeting ? (
        <MeetingKnowledgeView
          isWorkflowActionBusy={isWorkflowActionBusy}
          readOnly={isMeetingReadOnly(meetings.selectedMeeting)}
          selectedMeeting={meetings.selectedMeeting}
        />
      ) : (
        <section className="workbench-empty workbench-empty--canvas" aria-label="知识库">
          <h2>选择会议管理知识库</h2>
          <p>{meetings.filteredMeetings.length > 0 ? "从顶栏选择会议，即可查看或上传文档。" : canCreate ? "还没有会议，先创建一场。" : "还没有可查看的会议。"}</p>
          {canCreate && meetings.filteredMeetings.length === 0 && (            <button className="primary-button" onClick={modals.openCreate} type="button">
              新建会议
            </button>
          )}
        </section>
      )}
    </MeetingWorkspaceLayout>
  );
}

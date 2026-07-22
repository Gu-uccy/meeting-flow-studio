import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { canCreateMeeting, getProductRole, isMeetingReadOnly } from "./layout/navAccess";
import { MeetingChatView } from "./chat/MeetingChatView";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";

export function ChatPage() {
  const { user } = useAuth();
  const { chat, meetings, modals, derived } = useWorkbench();
  const canCreate = user ? canCreateMeeting(getProductRole(user)) : false;
  const isWorkflowActionBusy = meetings.isMutating || chat.isSending;

  return (
    <MeetingWorkspaceLayout hint={meetings.error || chat.error} id="meeting-chat">
      {meetings.selectedMeeting ? (
        <MeetingChatView
          canClearChat={!isMeetingReadOnly(meetings.selectedMeeting)}
          chat={chat}
          isWorkflowActionBusy={isWorkflowActionBusy}
          runtimeLabel={derived.modelRuntimeLabel}
          selectedMeeting={meetings.selectedMeeting}
        />
      ) : (
        <section className="workbench-empty workbench-empty--canvas" aria-label="会议对话">
          <h2>选择会议开始对话</h2>
          <p>{meetings.filteredMeetings.length > 0 ? "从顶栏选择会议，即可基于会议上下文与知识库问答。" : canCreate ? "还没有会议，先创建一场。" : "还没有可查看的会议。"}</p>
          {canCreate && meetings.filteredMeetings.length === 0 && (
            <button className="primary-button" onClick={modals.openCreate} type="button">
              新建会议
            </button>
          )}
        </section>
      )}
    </MeetingWorkspaceLayout>
  );
}

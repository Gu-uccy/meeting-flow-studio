import { useWorkbench } from "../../contexts/WorkbenchContext";
import { canCreateMeeting, canManageMeetingAppConnections, getProductRole } from "./layout/navAccess";
import { WorkflowTemplatePanel } from "../workflow/WorkflowTemplatePanel";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";
import { useAuth } from "../../contexts/AuthContext";

export function WorkspacePage() {
  const { user } = useAuth();
  const { meetings, modals, workflow, feishuCalendar, setWorkbenchView } = useWorkbench();
  const canCreate = user ? canCreateMeeting(getProductRole(user)) : false;
  const canConnect = user ? canManageMeetingAppConnections(getProductRole(user)) : false;
  const inlineError = meetings.error || workflow.error || meetings.feedback || workflow.feedback;
  const meetingAppConnected = feishuCalendar.isConfigured && feishuCalendar.isConnected;
  const meetingAppConfigured = feishuCalendar.isConfigured;
  const showConnectionGate = canConnect && meetingAppConfigured && !meetingAppConnected && !meetings.selectedMeeting;

  return (
    <MeetingWorkspaceLayout hint={inlineError} id="workflow-console">
      {meetings.selectedMeeting ? (
        <WorkflowTemplatePanel />
      ) : (
        <section className="workbench-empty workbench-empty--canvas" aria-label="入门指南" data-testid="meeting-empty">
          {showConnectionGate ? (
            <>
              <h2>先连接飞书</h2>
              <p>Meeting Flow 以真实会议为执行基础。请先连接飞书，再选择或创建会议。</p>
              <div className="workbench-empty__actions">
                {feishuCalendar.isConfigured ? (
                  <button
                    className="primary-button"
                    disabled={feishuCalendar.isMutating || feishuCalendar.isConnected}
                    onClick={() => void feishuCalendar.connectFeishuCalendar()}
                    type="button"
                  >
                    {feishuCalendar.isMutating ? "连接中..." : "连接飞书"}
                  </button>
                ) : null}
                <button className="ghost-button" onClick={() => setWorkbenchView("config")} type="button">
                  打开会议连接
                </button>
                {canCreate ? (
                  <button className="ghost-button" onClick={modals.openCreate} type="button">
                    仍要新建会议
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2>选择会议开始</h2>
              <p>
                {meetings.filteredMeetings.length > 0
                  ? "从顶栏选择一场会议，开始编排流程。"
                  : canCreate
                    ? "还没有会议，先创建一场。"
                    : "还没有可查看的会议。"}
              </p>
              {canCreate && meetings.filteredMeetings.length === 0 && (
                <button className="primary-button" onClick={modals.openCreate} type="button">
                  新建会议
                </button>
              )}
            </>
          )}
        </section>
      )}
    </MeetingWorkspaceLayout>
  );
}

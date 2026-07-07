import { useWorkbench } from "../../contexts/WorkbenchContext";
import { useWorkflowCanvasState } from "../../hooks/useWorkflowCanvasState";
import { RunDetailDialog } from "./RunDetailDialog";
import { WorkflowCanvasInspector } from "./WorkflowCanvasInspector";
import { WorkflowCanvasHeader, WorkflowCanvasPane } from "./WorkflowCanvasPane";
import { WorkflowMorePanel } from "./WorkflowMorePanel";
import { WorkflowSupportPanel } from "./WorkflowSupportPanel";
import { getNextMeetingStatus } from "./workflowPanelUtils";

export function WorkflowTemplatePanel() {
  const { agent, feishuCalendar, googleCalendar, meetings, memories, modals, openNodeAgent, workflow, canvasFocusRun, clearCanvasFocusRun } = useWorkbench();

  const selectedMeeting = meetings.selectedMeeting;
  const isMutating = meetings.isMutating;
  const isWorkflowLoading = workflow.isLoading;
  const workflowError = workflow.error;
  const workflowFeedback = workflow.feedback;
  const isWorkflowMutating = workflow.isMutating;
  const workflowRuns = workflow.runs;
  const workflowTemplates = workflow.templates;
  const isGoogleCalendarConfigured = googleCalendar.isConfigured;
  const isCalendarLoading = googleCalendar.isLoading;
  const isCalendarMutating = googleCalendar.isMutating;
  const googleRedirectUri = googleCalendar.redirectUri;
  const calendarStatusMessage = googleCalendar.statusMessage;
  const isGoogleCalendarConnected = googleCalendar.isConnected;
  const isFeishuCalendarConfigured = feishuCalendar.isConfigured;
  const isFeishuCalendarConnected = feishuCalendar.isConnected;
  const isFeishuCalendarLoading = feishuCalendar.isLoading;
  const isFeishuCalendarMutating = feishuCalendar.isMutating;
  const feishuRedirectUri = feishuCalendar.redirectUri;
  const feishuCalendarStatusMessage = feishuCalendar.statusMessage;
  const meetingMemories = memories.items;
  const isMemoryLoading = memories.isLoading;
  const isMemoryMutating = memories.isMutating;
  const memoryError = memories.error;
  const agentRun = agent.agentRun;
  const agentError = agent.error;
  const isAgentRunning = agent.isRunning;

  const canvas = useWorkflowCanvasState({
    selectedMeeting,
    workflowTemplates,
    workflowRuns,
    canvasFocusRun,
    onCanvasFocusApplied: clearCanvasFocusRun,
    onSaveTemplateCanvas: workflow.saveTemplateCanvas,
    onStartWorkflowRun: workflow.startRunForSelectedMeeting,
    onAdvanceWorkflowRun: workflow.advanceRunAndReloadMemories,
    onRetryWorkflowRun: workflow.retryRunAndReloadMemories,
    onCancelWorkflowRun: workflow.cancelWorkflowRun
  });

  const canSyncFeishuCalendar = !isFeishuCalendarConfigured || isFeishuCalendarConnected;
  const canSyncGoogleCalendar = !isGoogleCalendarConfigured || isGoogleCalendarConnected;
  const actionCount = selectedMeeting?.actionItems.length ?? 0;
  const nextMeetingStatus = selectedMeeting ? getNextMeetingStatus(selectedMeeting.status) : null;
  const isWorkflowActionBusy = isMutating || isWorkflowMutating || isCalendarMutating || isFeishuCalendarMutating || isAgentRunning;

  const onOpenDetail = () => {
    if (selectedMeeting) modals.openDetail(selectedMeeting.id);
  };
  const onEditMeeting = () => {
    if (selectedMeeting) modals.openEdit(selectedMeeting.id);
  };
  const onSyncGoogleCalendar = () => (selectedMeeting ? googleCalendar.syncMeeting(selectedMeeting.id) : Promise.resolve(null));
  const onSyncFeishuCalendar = () => (selectedMeeting ? feishuCalendar.syncMeeting(selectedMeeting.id) : Promise.resolve(null));

  if (isWorkflowLoading && workflowTemplates.length === 0) {
    return (
      <section className="workflow-shell workflow-shell--console ide-workflow workflow-empty-state">
        <div>
          <span>工作流模板</span>
          <strong>正在加载模板和运行记录...</strong>
        </div>
      </section>
    );
  }

  if (!canvas.selectedTemplate || (!canvas.selectedNode && !canvas.selectedEdge)) {
    return (
      <section className="workflow-shell workflow-shell--console ide-workflow workflow-empty-state">
        <div>
          <span>工作流模板</span>
          <strong>{workflowError || "暂无可用模板"}</strong>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={`workflow-shell workflow-shell--console ide-workflow${
          canvas.isCanvasEditMode
            ? " is-editing"
            : canvas.isWorkflowDetailOpen
              ? " is-detail"
              : canvas.isWorkflowMoreOpen
                ? " is-more"
                : " is-simple"
        }`}
      >
        <WorkflowCanvasHeader
          isCanvasDirty={canvas.isCanvasDirty}
          isCanvasEditMode={canvas.isCanvasEditMode}
          isWorkflowDetailOpen={canvas.isWorkflowDetailOpen}
          isWorkflowMoreOpen={canvas.isWorkflowMoreOpen}
          onSetCanvasEditMode={canvas.setIsCanvasEditMode}
          onSetWorkflowDetailOpen={canvas.setIsWorkflowDetailOpen}
          onSetWorkflowMoreOpen={canvas.setIsWorkflowMoreOpen}
        />

        <WorkflowCanvasPane
          actionCount={actionCount}
          availableRuns={canvas.availableRuns}
          filteredRuns={canvas.filteredRuns}
          blockedNodeRun={canvas.blockedNodeRun}
          canvasNodes={canvas.canvasNodes}
          canvasWrapperRef={canvas.reactFlowWrapper}
          isCanvasDirty={canvas.isCanvasDirty}
          isCanvasEditMode={canvas.isCanvasEditMode}
          isCanvasZoomFocused={canvas.isCanvasZoomFocused}
          isValidConnection={canvas.isValidConnection}
          isWorkflowDetailOpen={canvas.isWorkflowDetailOpen}
          isWorkflowMoreOpen={canvas.isWorkflowMoreOpen}
          isWorkflowActionBusy={isWorkflowActionBusy}
          onAddNode={canvas.handleAddNode}
          onCreateTemplate={() => void workflow.createWorkflowTemplate()}
          onDeleteTemplate={() => {
            const remaining = workflow.templates.filter((item) => item.id !== canvas.selectedTemplateId);
            void workflow.deleteWorkflowTemplate(canvas.selectedTemplateId).then((ok) => {
              if (ok && remaining[0]) {
                canvas.selectTemplate(remaining[0].id);
              }
            });
          }}
          onDuplicateTemplate={() => void workflow.duplicateWorkflowTemplate(canvas.selectedTemplateId).then((template) => {
            if (template) canvas.selectTemplate(template.id);
          })}
          onExportTemplate={() => void workflow.exportWorkflowTemplate(canvas.selectedTemplateId)}
          onImportTemplate={(template) => void workflow.importWorkflowTemplate(template).then((imported) => {
            if (imported) canvas.selectTemplate(imported.id);
          })}
          onApplyTemplateVersion={(versionId) => void workflow.applyWorkflowTemplateVersion(canvas.selectedTemplateId, versionId)}
          onCreateTemplateVersion={(status, summary) => void workflow.createWorkflowTemplateVersion(canvas.selectedTemplateId, status, summary)}
          onAdvanceWorkflowRun={() => void canvas.handleAdvanceWorkflowRun()}
          onConnect={canvas.handleConnect}
          onDeleteSelectedNode={canvas.handleDeleteSelectedNode}
          onDragOver={canvas.handleDragOver}
          onDrop={canvas.handleDrop}
          onEdgeClick={canvas.handleEdgeClick}
          onEdgesChange={canvas.handleEdgesChange}
          onFlowInit={(instance) => { canvas.reactFlowInstance.current = instance; }}
          onNodeClick={canvas.handleNodeClick}
          onNodesChange={canvas.handleNodesChange}
          onResetCanvas={canvas.handleResetCanvas}
          onRetryWorkflowRun={() => void canvas.handleRetryWorkflowRun()}
          onSaveCanvas={() => void canvas.handleSaveCanvas()}
          onSelectRun={canvas.selectRun}
          onSelectTemplate={canvas.selectTemplate}
          runStatusFilter={canvas.runStatusFilter}
          setRunStatusFilter={canvas.setRunStatusFilter}
          onSetCanvasEditMode={canvas.setIsCanvasEditMode}
          onSetCanvasZoomFocused={canvas.setIsCanvasZoomFocused}
          onSetWorkflowDetailOpen={canvas.setIsWorkflowDetailOpen}
          onSetWorkflowMoreOpen={canvas.setIsWorkflowMoreOpen}
          onStartWorkflowRun={() => void canvas.handleStartWorkflowRun()}
          selectedFlowNodeId={canvas.selectedFlowNodeId}
          selectedInputPayload={canvas.selectedInputPayload}
          selectedMeeting={selectedMeeting}
          selectedNode={canvas.selectedNode}
          selectedNodeConfigSnapshot={canvas.selectedNodeConfigSnapshot}
          selectedNodeRun={canvas.selectedNodeRun}
          selectedOutputPayload={canvas.selectedOutputPayload}
          selectedRun={canvas.selectedRun}
          selectedTemplate={canvas.selectedTemplate}
          selectedTemplateId={canvas.selectedTemplateId}
          setSelectedFlowNodeId={canvas.setSelectedFlowNodeId}
          workflowEdges={canvas.workflowEdges}
          workflowNodes={canvas.workflowNodes}
          workflowTemplates={workflowTemplates}
        />

        {canvas.isCanvasEditMode && (
          <WorkflowCanvasInspector
            canvasNodes={canvas.canvasNodes}
            isCanvasDirty={canvas.isCanvasDirty}
            isWorkflowActionBusy={isWorkflowActionBusy}
            onDeleteSelectedEdge={canvas.handleDeleteSelectedEdge}
            onOpenNodeAgent={openNodeAgent}
            onResetCanvas={canvas.handleResetCanvas}
            onSaveCanvas={() => void canvas.handleSaveCanvas()}
            selectedEdge={canvas.selectedEdge}
            selectedNode={canvas.selectedNode}
            selectedTemplateId={canvas.selectedTemplateId}
            updateCanvasEdge={canvas.updateCanvasEdge}
            updateCanvasNode={canvas.updateCanvasNode}
          />
        )}

        {canvas.isWorkflowDetailOpen && !canvas.isCanvasEditMode && (
          <WorkflowSupportPanel
            blockedNodeRun={canvas.blockedNodeRun}
            isMemoryLoading={isMemoryLoading}
            isMemoryMutating={isMemoryMutating}
            isWorkflowActionBusy={isWorkflowActionBusy}
            meetingMemories={meetingMemories}
            memoryError={memoryError}
            nextMeetingStatus={nextMeetingStatus}
            onAdvanceWorkflowRun={() => void canvas.handleAdvanceWorkflowRun()}
            onCancelWorkflowRun={() => void canvas.handleCancelWorkflowRun()}
            onDeleteMemory={memories.deleteMemory}
            onEditMeeting={onEditMeeting}
            onOpenDetail={onOpenDetail}
            onOpenRunDetail={() => canvas.setIsRunDetailOpen(true)}
            onRetryWorkflowRun={() => void canvas.handleRetryWorkflowRun()}
            onStartWorkflowRun={() => void canvas.handleStartWorkflowRun()}
            onUpdateMemory={memories.updateMemory}
            onUpdateStatus={meetings.updateMeetingStatus}
            resolutionNote={canvas.resolutionNote}
            selectedFlowNodeId={canvas.selectedFlowNodeId}
            selectedInputPayload={canvas.selectedInputPayload}
            selectedMeeting={selectedMeeting}
            selectedNode={canvas.selectedNode}
            selectedNodeRun={canvas.selectedNodeRun}
            selectedOutputPayload={canvas.selectedOutputPayload}
            selectedRun={canvas.selectedRun}
            selectedTemplate={canvas.selectedTemplate}
            setResolutionNote={canvas.setResolutionNote}
            setSelectedFlowNodeId={canvas.setSelectedFlowNodeId}
            workflowFeedback={workflowFeedback}
          />
        )}

        {canvas.isWorkflowMoreOpen && !canvas.isCanvasEditMode && (
          <WorkflowMorePanel
            agentActionFeedback={agent.actionFeedback}
            agentError={agentError}
            agentRun={agentRun}
            calendarStatusMessage={calendarStatusMessage}
            canSyncFeishuCalendar={canSyncFeishuCalendar}
            canSyncGoogleCalendar={canSyncGoogleCalendar}
            feishuCalendarStatusMessage={feishuCalendarStatusMessage}
            feishuRedirectUri={feishuRedirectUri}
            googleRedirectUri={googleRedirectUri}
            isAgentRunning={isAgentRunning}
            isCalendarLoading={isCalendarLoading}
            isFeishuCalendarConfigured={isFeishuCalendarConfigured}
            isFeishuCalendarConnected={isFeishuCalendarConnected}
            isFeishuCalendarLoading={isFeishuCalendarLoading}
            isGoogleCalendarConfigured={isGoogleCalendarConfigured}
            isGoogleCalendarConnected={isGoogleCalendarConnected}
            isWorkflowActionBusy={isWorkflowActionBusy}
            onConnectFeishuCalendar={() => void feishuCalendar.connectFeishuCalendar()}
            onConnectGoogleCalendar={() => void googleCalendar.connectGoogleCalendar()}
            onExecuteAgentAction={(action) => void agent.executeAgentAction(action)}
            onRunAgent={() => void agent.runAgentAndReload()}
            onSyncFeishuCalendar={() => void onSyncFeishuCalendar()}
            onSyncGoogleCalendar={() => void onSyncGoogleCalendar()}
            selectedMeeting={selectedMeeting}
            workflowTemplates={workflowTemplates}
          />
        )}
      </section>

      {canvas.isRunDetailOpen && canvas.selectedRun && (
        <RunDetailDialog
          meeting={selectedMeeting}
          onClose={() => canvas.setIsRunDetailOpen(false)}
          run={canvas.selectedRun}
          template={canvas.selectedTemplate}
        />
      )}
    </>
  );
}

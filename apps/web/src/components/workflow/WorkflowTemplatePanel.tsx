import { useWorkbench } from "../../contexts/WorkbenchContext";
import { isMeetingReadOnly } from "../workbench/layout/navAccess";
import { useWorkflowCanvasController } from "../../hooks/useWorkflowCanvasController";
import { WorkflowEditorLayout } from "./editor/WorkflowEditorLayout";
import { WorkflowEditorToolbar } from "./editor/WorkflowEditorToolbar";
import { WorkflowExecutionDock } from "./editor/WorkflowExecutionDock";
import { WorkflowNodeConfigPanel } from "./editor/WorkflowNodeConfigPanel";
import { WorkflowNodePalette } from "./editor/WorkflowNodePalette";
import { RunDetailDialog } from "./RunDetailDialog";
import { WorkflowCanvasPane } from "./WorkflowCanvasPane";

export function WorkflowTemplatePanel() {
  const { meetings, openNodeAgent, workflow, canvasFocusRun, clearCanvasFocusRun } = useWorkbench();

  const selectedMeeting = meetings.selectedMeeting;
  const isReadOnly = isMeetingReadOnly(selectedMeeting);
  const isWorkflowLoading = workflow.isLoading;
  const workflowError = workflow.error;
  const workflowFeedback = workflow.feedback;
  const isWorkflowMutating = workflow.isMutating;
  const workflowRuns = workflow.runs;
  const workflowTemplates = workflow.templates;
  const isWorkflowActionBusy = meetings.isMutating || isWorkflowMutating;

  const canvas = useWorkflowCanvasController({
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

  if (isWorkflowLoading && workflowTemplates.length === 0) {
    return (
      <section className="workflow-shell workflow-shell--canvas workflow-empty-state">
        <strong>正在加载模板…</strong>
      </section>
    );
  }

  if (!canvas.selectedTemplate) {
    return (
      <section className="workflow-shell workflow-shell--canvas workflow-empty-state">
        <strong>{workflowError || "暂无可用模板"}</strong>
      </section>
    );
  }

  return (
    <>
      <WorkflowEditorLayout
        canvas={(
          <WorkflowCanvasPane
            canvasWrapperRef={canvas.reactFlowWrapper}
            isCanvasEmpty={canvas.canvasNodes.length === 0}
            isCanvasZoomFocused={canvas.isCanvasZoomFocused}
            isValidConnection={canvas.isValidConnection}
            onAddNode={canvas.handleAddNode}
            onConnect={canvas.handleConnect}
            onDragOver={canvas.handleDragOver}
            onDrop={canvas.handleDrop}
            onEdgeClick={canvas.handleEdgeClick}
            onEdgeDoubleClick={canvas.handleEdgeDoubleClick}
            onEdgesChange={canvas.handleEdgesChange}
            onFlowInit={canvas.handleFlowInit}
            onNodeClick={canvas.handleNodeClick}
            onNodesChange={canvas.handleNodesChange}
            onPaneClick={canvas.handlePaneClick}
            onSetCanvasZoomFocused={canvas.setCanvasZoomFocused}
            readOnly={isReadOnly}
            selectedMeeting={selectedMeeting}
            selectedRun={canvas.selectedRun}
            workflowEdges={canvas.workflowEdges}
            workflowNodes={canvas.workflowNodes}
          />
        )}
        configPanel={isReadOnly ? undefined : (
          <WorkflowNodeConfigPanel
            canvasNodes={canvas.canvasNodes}
            isCanvasDirty={canvas.isCanvasDirty}
            isWorkflowActionBusy={isWorkflowActionBusy}
            onClearSelection={canvas.handlePaneClick}
            onDeleteSelectedEdge={canvas.handleDeleteSelectedEdge}
            onDeleteSelectedNode={canvas.handleDeleteSelectedNode}
            onOpenNodeAgent={openNodeAgent}
            onResetCanvas={canvas.handleResetCanvas}
            onSaveCanvas={() => void canvas.handleSaveCanvas()}
            selectedEdge={canvas.editorEdge}
            selectedNode={canvas.editorNode}
            selectedTemplateId={canvas.selectedTemplateId}
            updateCanvasEdge={canvas.updateCanvasEdge}
            updateCanvasNode={canvas.updateCanvasNode}
          />
        )}
        executionDock={(
          <WorkflowExecutionDock
            blockedNodeRun={canvas.blockedNodeRun}
            isWorkflowActionBusy={isWorkflowActionBusy}
            onAdvanceWorkflowRun={() => void canvas.handleAdvanceWorkflowRun()}
            onCancelWorkflowRun={() => void canvas.handleCancelWorkflowRun()}
            onOpenRunDetail={() => canvas.setRunDetailOpen(true)}
            onRetryWorkflowRun={() => void canvas.handleRetryWorkflowRun()}
            onStartWorkflowRun={() => void canvas.handleStartWorkflowRun()}
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
            readOnly={isReadOnly}
          />
        )}
        palette={isReadOnly ? undefined : <WorkflowNodePalette />}
        readOnly={isReadOnly}
        toolbar={(
          <WorkflowEditorToolbar
            blockedNodeRun={canvas.blockedNodeRun}
            canvasNodesCount={canvas.canvasNodes.length}
            isCanvasDirty={canvas.isCanvasDirty}
            isWorkflowActionBusy={isWorkflowActionBusy}
            onAddNode={canvas.handleAddNode}
            onAdvanceWorkflowRun={() => void canvas.handleAdvanceWorkflowRun()}
            onCreateTemplate={() => void workflow.createWorkflowTemplate()}
            onDeleteSelectedNode={canvas.handleDeleteSelectedNode}
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
            onResetCanvas={canvas.handleResetCanvas}
            onRetryWorkflowRun={() => void canvas.handleRetryWorkflowRun()}
            onSaveCanvas={() => void canvas.handleSaveCanvas()}
            onSelectTemplate={canvas.selectTemplate}
            onStartWorkflowRun={() => void canvas.handleStartWorkflowRun()}
            selectedMeeting={selectedMeeting}
            selectedNodeId={canvas.selectedFlowNodeId}
            selectedRun={canvas.selectedRun}
            selectedTemplate={canvas.selectedTemplate}
            selectedTemplateId={canvas.selectedTemplateId}
            workflowTemplates={workflowTemplates}
          />
        )}
      />

      {canvas.isRunDetailOpen && canvas.selectedRun && (
        <RunDetailDialog
          meeting={selectedMeeting}
          onClose={() => canvas.setRunDetailOpen(false)}
          run={canvas.selectedRun}
          template={canvas.selectedTemplate}
        />
      )}
    </>
  );
}

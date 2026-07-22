import type { MeetingRecord, ProductNodeRun, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { ModelRuntimeBadge } from "../../workbench/layout/ModelRuntimeBadge";
import { useWorkbench } from "../../../contexts/WorkbenchContext";
import { WorkflowTemplatePicker } from "../WorkflowTemplatePicker";
import { WorkflowUnsavedDialog } from "./WorkflowUnsavedDialog";
import { useWorkflowUnsavedGuard } from "../../../hooks/useWorkflowUnsavedGuard";

type WorkflowEditorToolbarProps = {
  blockedNodeRun?: ProductNodeRun;
  canvasNodesCount: number;
  isCanvasDirty: boolean;
  isWorkflowActionBusy: boolean;
  onAddNode: () => void;
  onAdvanceWorkflowRun: () => void;
  onCreateTemplate: () => void;
  onDeleteSelectedNode: () => void;
  onDeleteTemplate: () => void;
  onDuplicateTemplate: () => void;
  onExportTemplate: () => void;
  onImportTemplate: (template: ProductWorkflowTemplate) => void;
  onResetCanvas: () => void;
  onRetryWorkflowRun: () => void;
  onSaveCanvas: () => void;
  onSelectTemplate: (templateId: string) => void;
  onStartWorkflowRun: () => void;
  selectedMeeting: MeetingRecord | null;
  selectedNodeId: string;
  selectedRun: ProductWorkflowRun | null;
  selectedTemplate: ProductWorkflowTemplate;
  selectedTemplateId: string;
  workflowTemplates: ProductWorkflowTemplate[];
};

export function WorkflowEditorToolbar(props: WorkflowEditorToolbarProps) {
  const {
    blockedNodeRun,
    canvasNodesCount,
    isCanvasDirty,
    isWorkflowActionBusy,
    onAddNode,
    onAdvanceWorkflowRun,
    onCreateTemplate,
    onDeleteSelectedNode,
    onDeleteTemplate,
    onDuplicateTemplate,
    onExportTemplate,
    onImportTemplate,
    onResetCanvas,
    onRetryWorkflowRun,
    onSaveCanvas,
    onSelectTemplate,
    onStartWorkflowRun,
    selectedMeeting,
    selectedNodeId,
    selectedRun,
    selectedTemplate,
    selectedTemplateId,
    workflowTemplates
  } = props;

  const {
    cancelTemplateSwitch,
    confirmTemplateSwitch,
    pendingTemplateId,
    requestTemplateSwitch
  } = useWorkflowUnsavedGuard(isCanvasDirty);
  const { derived } = useWorkbench();

  const pendingTemplate = workflowTemplates.find((template) => template.id === pendingTemplateId);

  return (
    <>
      <div className="workflow-editor__toolbar canvas-toolbar" aria-label="编辑器工具栏">
      <div className="canvas-toolbar__section canvas-toolbar__section--template">
        <WorkflowTemplatePicker
          onCreateTemplate={onCreateTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onDuplicateTemplate={onDuplicateTemplate}
          onExportTemplate={onExportTemplate}
          onImportTemplate={onImportTemplate}
          onSelectTemplate={(templateId) => requestTemplateSwitch(templateId, selectedTemplateId, onSelectTemplate)}
          selectedTemplateId={selectedTemplateId}
          workflowTemplates={workflowTemplates}
        />
        {isCanvasDirty ? <span className="workflow-editor__unsaved" title="画布有未保存修改">● 未保存</span> : null}
      </div>

      <div className="canvas-toolbar__section canvas-toolbar__section--actions">
        <button className="canvas-icon-button" disabled={isWorkflowActionBusy} onClick={onAddNode} title="添加节点" type="button">+</button>
        <button
          className="canvas-icon-button"
          disabled={isWorkflowActionBusy || !selectedNodeId || canvasNodesCount <= 1}
          onClick={onDeleteSelectedNode}
          title="删除节点"
          type="button"
        >
          −
        </button>
        <button className="canvas-icon-button" disabled={isWorkflowActionBusy || !isCanvasDirty} onClick={onResetCanvas} title="撤销" type="button">↶</button>
        <button className="canvas-icon-button canvas-icon-button--accent" disabled={isWorkflowActionBusy || !isCanvasDirty} onClick={() => void onSaveCanvas()} title="保存" type="button">保存</button>
      </div>

      <div className="canvas-toolbar__section canvas-toolbar__section--runtime">
        <ModelRuntimeBadge compact label={derived.modelRuntimeLabel} />
      </div>

      <div className="canvas-toolbar__section canvas-toolbar__section--run">
        <button
          className="canvas-icon-button canvas-icon-button--run"
          data-testid="workflow-run"
          disabled={!selectedMeeting || !selectedTemplate || isWorkflowActionBusy}
          onClick={() => void (blockedNodeRun ? onAdvanceWorkflowRun() : onStartWorkflowRun())}
          title={blockedNodeRun ? "继续" : "运行"}
          type="button"
        >
          {blockedNodeRun ? "继续" : "运行"}
        </button>
        <button
          className="canvas-icon-button"
          disabled={!selectedRun || isWorkflowActionBusy}
          onClick={() => void onRetryWorkflowRun()}
          title="重跑"
          type="button"
        >
          重跑
        </button>
      </div>
    </div>

      {pendingTemplate ? (
        <WorkflowUnsavedDialog
          onCancel={cancelTemplateSwitch}
          onConfirm={() => confirmTemplateSwitch(onSelectTemplate)}
          targetName={pendingTemplate.name}
        />
      ) : null}
    </>
  );
}

import { useRef } from "react";
import {
  meetingNodeKindLabels,
  meetingNodeKinds,
  type ProductWorkflowEdge,
  type ProductWorkflowNode,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";
import { WorkflowEdgeConfigPanel } from "./editor/WorkflowEdgeConfigPanel";
import { parseList, formatList, toneByKind } from "./workflowPanelUtils";

type WorkflowCanvasInspectorProps = {
  canvasNodes: ProductWorkflowNode[];
  isCanvasDirty: boolean;
  isWorkflowActionBusy: boolean;
  onDeleteSelectedEdge: () => void;
  onOpenNodeAgent?: (templateId: string, nodeId: string) => void;
  onResetCanvas: () => void;
  onSaveCanvas: () => void;
  selectedEdge: ProductWorkflowEdge | null;
  selectedNode: ProductWorkflowNode | null;
  selectedTemplateId: string;
  updateCanvasEdge: (edgeId: string, update: (edge: ProductWorkflowEdge) => ProductWorkflowEdge) => void;
  updateCanvasNode: (nodeId: string, update: (node: ProductWorkflowNode) => ProductWorkflowNode) => void;
};

type WorkflowInspectorEditorProps = WorkflowCanvasInspectorProps & {
  onDeleteSelectedNode?: () => void;
  variant?: "sidebar" | "floating";
};

const configFieldHints: Record<string, string> = {
  temperature: "控制 AI 输出的随机程度：越低越稳定，越高越有创意。"
};

function formatConfigFieldLabel(field: { key: string; label: string }) {
  if (field.key === "temperature" && field.label === "温度") {
    return "创造性";
  }
  return field.label;
}

export function WorkflowInspectorEditor({
  isCanvasDirty,
  isWorkflowActionBusy,
  onDeleteSelectedNode,
  onOpenNodeAgent,
  onResetCanvas,
  onSaveCanvas,
  selectedNode,
  selectedTemplateId,
  updateCanvasNode,
  variant = "sidebar"
}: WorkflowInspectorEditorProps) {
  const compact = variant === "floating";
  const canOpenNodeAgent = Boolean(
    selectedNode
      && onOpenNodeAgent
      && ["ai", "knowledge", "decision", "action"].includes(selectedNode.kind)
  );

  if (!selectedNode) {
    return null;
  }

  return (
    <div className={`ide-inspector__body scroll-area${compact ? " ide-inspector__body--compact" : ""}`}>
      <div className="ide-form">
        <label>
          标题
          <input
            value={selectedNode.title}
            onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, title: event.target.value }))}
          />
        </label>
        {!compact && (
          <label>
            描述
            <textarea
              value={selectedNode.description}
              onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, description: event.target.value }))}
            />
          </label>
        )}
        <label>
          类型
          <Dropdown<ProductWorkflowNode["kind"]>
            ariaLabel="节点类型"
            onChange={(value) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, kind: value }))}
            options={meetingNodeKinds.map((kind) => ({ label: meetingNodeKindLabels[kind], value: kind }))}
            value={selectedNode.kind}
          />
        </label>
        {!compact && (
          <>
            <label>
              负责人
              <input
                value={selectedNode.owner}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, owner: event.target.value }))}
              />
            </label>
            <label>
              输入
              <input
                value={formatList(selectedNode.inputs)}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, inputs: parseList(event.target.value) }))}
              />
            </label>
            <label>
              输出
              <input
                value={formatList(selectedNode.outputs)}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, outputs: parseList(event.target.value) }))}
              />
            </label>
          </>
        )}
        {selectedNode.configFields.slice(0, compact ? 2 : undefined).map((field) => (
          <label key={field.key} title={configFieldHints[field.key]}>
            {formatConfigFieldLabel(field)}
            {configFieldHints[field.key] ? (
              <small className="ide-form__hint">{configFieldHints[field.key]}</small>
            ) : null}
            {field.kind === "textarea" ? (
              <textarea
                value={field.value}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({
                  ...node,
                  configFields: node.configFields.map((item) =>
                    item.key === field.key ? { ...item, value: event.target.value } : item
                  )
                }))}
              />
            ) : (
              <input
                value={field.value}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({
                  ...node,
                  configFields: node.configFields.map((item) =>
                    item.key === field.key ? { ...item, value: event.target.value } : item
                  )
                }))}
              />
            )}
          </label>
        ))}
        {canOpenNodeAgent && !compact && (
          <div className="ide-config-actions ide-config-actions--agent">
            <button
              className="ghost-button"
              disabled={isWorkflowActionBusy}
              onClick={() => onOpenNodeAgent?.(selectedTemplateId, selectedNode.id)}
              type="button"
            >
              智能体编辑
            </button>
          </div>
        )}
      </div>
      <div className="ide-config-actions ide-config-actions--compact">
        {onDeleteSelectedNode && (
          <button
            className="danger-button"
            disabled={isWorkflowActionBusy}
            onClick={onDeleteSelectedNode}
            type="button"
          >
            删节点
          </button>
        )}
        <button className="ghost-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={onResetCanvas} type="button">
          撤销
        </button>
        <button className="primary-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={() => void onSaveCanvas()} type="button">
          保存
        </button>
      </div>
    </div>
  );
}

export function WorkflowCanvasInspector(props: WorkflowCanvasInspectorProps) {
  const { canvasNodes, selectedEdge, selectedNode } = props;
  return (
    <aside className="ide-inspector" aria-label={selectedEdge ? "连线配置面板" : "节点配置面板"}>
      <div className="ide-pane-header ide-pane-header--stacked">
        {selectedEdge ? (
          <>
            <span>连线</span>
            <strong>
              {`${canvasNodes.find((node) => node.id === selectedEdge.source)?.title ?? selectedEdge.source} → ${
                canvasNodes.find((node) => node.id === selectedEdge.target)?.title ?? selectedEdge.target
              }`}
            </strong>
          </>
        ) : (
          <strong className="inspector-main-title">{selectedNode?.title ?? "节点"}</strong>
        )}
      </div>
      {selectedEdge ? (
        <WorkflowEdgeConfigPanel
          canvasNodes={props.canvasNodes}
          isCanvasDirty={props.isCanvasDirty}
          isWorkflowActionBusy={props.isWorkflowActionBusy}
          onDeleteSelectedEdge={props.onDeleteSelectedEdge}
          onSaveCanvas={props.onSaveCanvas}
          selectedEdge={selectedEdge}
          updateCanvasEdge={props.updateCanvasEdge}
        />
      ) : (
        <WorkflowInspectorEditor {...props} />
      )}
    </aside>
  );
}

export function WorkflowCanvasEditorToolbar({
  canvasNodes,
  isCanvasDirty,
  isWorkflowActionBusy,
  onAddNode,
  onCreateTemplate,
  onDeleteSelectedNode,
  onDeleteTemplate,
  onDuplicateTemplate,
  onExportTemplate,
  onImportTemplate,
  onResetCanvas,
  onSaveCanvas,
  onSelectTemplate,
  selectedNode,
  selectedTemplateId,
  workflowTemplates
}: {
  canvasNodes: ProductWorkflowNode[];
  isCanvasDirty: boolean;
  isWorkflowActionBusy: boolean;
  onAddNode: () => void;
  onCreateTemplate: () => void;
  onDeleteSelectedNode: () => void;
  onDeleteTemplate: () => void;
  onDuplicateTemplate: () => void;
  onExportTemplate: () => void;
  onImportTemplate: (template: ProductWorkflowTemplate) => void;
  onResetCanvas: () => void;
  onSaveCanvas: () => void;
  onSelectTemplate: (templateId: string) => void;
  selectedNode: ProductWorkflowNode | null;
  selectedTemplateId: string;
  workflowTemplates: Array<{ id: string; name: string }>;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="workflow-template-row">
      <div className="workflow-template-row__main">
        <div className="template-switcher ide-tabs" aria-label="模板选择">
          {workflowTemplates.map((template) => (
            <button
              className={template.id === selectedTemplateId ? "is-active" : ""}
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              type="button"
            >
              {template.name}
            </button>
          ))}
        </div>
        <div className="template-switcher__actions" aria-label="模板管理">
          <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onCreateTemplate} type="button">新建</button>
          <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onDuplicateTemplate} type="button">复制</button>
          <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onExportTemplate} type="button">导出</button>
          <button
            className="ghost-button"
            disabled={isWorkflowActionBusy}
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            导入
          </button>
          <button
            className="ghost-button"
            disabled={isWorkflowActionBusy || workflowTemplates.length <= 1}
            onClick={onDeleteTemplate}
            type="button"
          >
            删除
          </button>
          <input
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              void file.text().then((text) => {
                const parsed = JSON.parse(text) as ProductWorkflowTemplate;
                onImportTemplate(parsed);
              }).catch(() => {
                // Parent hook surfaces errors.
              }).finally(() => {
                event.target.value = "";
              });
            }}
            ref={importInputRef}
            type="file"
          />
        </div>
        <div className="node-palette node-palette--toolbar" aria-label="节点面板">
          <span>拖入画布</span>
          {meetingNodeKinds.map((kind) => (
            <div
              className="node-palette__item"
              draggable
              key={kind}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/reactflow-kind", kind);
                event.dataTransfer.effectAllowed = "move";
              }}
              title={`拖入画布创建 ${meetingNodeKindLabels[kind]} 节点`}
            >
              <i style={{ background: toneByKind[kind] }} />
              <span>{meetingNodeKindLabels[kind]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="canvas-editor-actions canvas-editor-actions--toolbar" aria-label="画布编辑">
        <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onAddNode} type="button">添加节点</button>
        <button className="ghost-button" disabled={isWorkflowActionBusy || !selectedNode || canvasNodes.length <= 1} onClick={onDeleteSelectedNode} type="button">删除节点</button>
        <button className="ghost-button" disabled={isWorkflowActionBusy || !isCanvasDirty} onClick={onResetCanvas} type="button">撤销修改</button>
        <button className="primary-button" disabled={isWorkflowActionBusy || !isCanvasDirty} onClick={() => void onSaveCanvas()} type="button">保存画布</button>
      </div>
    </div>
  );
}

import { useRef } from "react";
import {
  meetingNodeKindLabels,
  meetingNodeKinds,
  type ProductWorkflowEdge,
  type ProductWorkflowNode,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";
import {
  formatDataMapping,
  formatList,
  parseDataMapping,
  parseList,
  toneByKind
} from "./workflowPanelUtils";

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

export function WorkflowCanvasInspector({
  canvasNodes,
  isCanvasDirty,
  isWorkflowActionBusy,
  onDeleteSelectedEdge,
  onOpenNodeAgent,
  onResetCanvas,
  onSaveCanvas,
  selectedEdge,
  selectedNode,
  selectedTemplateId,
  updateCanvasEdge,
  updateCanvasNode
}: WorkflowCanvasInspectorProps) {
  const canOpenNodeAgent = Boolean(
    selectedNode
      && onOpenNodeAgent
      && ["ai", "knowledge", "decision", "action"].includes(selectedNode.kind)
  );
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
            <p>{selectedEdge.condition || selectedEdge.label || "配置这条连线的标签、条件和数据映射。"}</p>
          </>
        ) : (
          <strong className="inspector-main-title">节点</strong>
        )}
      </div>

      <div className="ide-inspector__body scroll-area">
        {selectedEdge ? (
          <>
            <div className="ide-form">
              <label>
                源节点
                <input readOnly value={canvasNodes.find((node) => node.id === selectedEdge.source)?.title ?? selectedEdge.source} />
              </label>
              <label>
                目标节点
                <input readOnly value={canvasNodes.find((node) => node.id === selectedEdge.target)?.title ?? selectedEdge.target} />
              </label>
              <label>
                连线标签
                <input
                  value={selectedEdge.label}
                  onChange={(event) => updateCanvasEdge(selectedEdge.id, (edge) => ({ ...edge, label: event.target.value }))}
                />
              </label>
              <label>
                运行条件
                <textarea
                  value={selectedEdge.condition ?? ""}
                  onChange={(event) => updateCanvasEdge(selectedEdge.id, (edge) => ({
                    ...edge,
                    condition: event.target.value.trim() ? event.target.value : undefined
                  }))}
                />
              </label>
              <label>
                数据映射
                <textarea
                  value={formatDataMapping(selectedEdge.dataMapping)}
                  onChange={(event) => {
                    const dataMapping = parseDataMapping(event.target.value);
                    updateCanvasEdge(selectedEdge.id, (edge) => ({
                      ...edge,
                      dataMapping: Object.keys(dataMapping).length > 0 ? dataMapping : undefined
                    }));
                  }}
                />
              </label>
            </div>
            <div className="ide-config-actions">
              <button className="danger-button" disabled={isWorkflowActionBusy} onClick={onDeleteSelectedEdge} type="button">
                删除连线
              </button>
              <button className="primary-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={() => void onSaveCanvas()} type="button">
                保存画布
              </button>
            </div>
          </>
        ) : selectedNode ? (
          <div className="ide-form">
            <label>
              节点标题
              <input
                value={selectedNode.title}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, title: event.target.value }))}
              />
            </label>
            <label>
              节点描述
              <textarea
                value={selectedNode.description}
                onChange={(event) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, description: event.target.value }))}
              />
            </label>
            <label>
              节点类型
              <Dropdown<ProductWorkflowNode["kind"]>
                ariaLabel="节点类型"
                onChange={(value) => updateCanvasNode(selectedNode.id, (node) => ({ ...node, kind: value }))}
                options={meetingNodeKinds.map((kind) => ({ label: meetingNodeKindLabels[kind], value: kind }))}
                value={selectedNode.kind}
              />
            </label>
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
            {selectedNode.configFields.map((field) => (
              <label key={field.key}>
                {field.label}
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
            {canOpenNodeAgent && selectedNode && (
              <div className="ide-config-actions ide-config-actions--agent">
                <button
                  className="ghost-button"
                  disabled={isWorkflowActionBusy}
                  onClick={() => onOpenNodeAgent?.(selectedTemplateId, selectedNode.id)}
                  type="button"
                >
                  在节点智能体管理中编辑
                </button>
                <p className="ide-config-hint">配置 Prompt、Schema、字段映射与版本，类似 Dify 的 LLM / Tool 节点编辑器。</p>
              </div>
            )}
            <div className="ide-config-actions">
              <button className="ghost-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={onResetCanvas} type="button">
                放弃修改
              </button>
              <button className="primary-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={() => void onSaveCanvas()} type="button">
                保存画布
              </button>
            </div>
          </div>
        ) : null}
      </div>
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

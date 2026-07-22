import { useEffect, useState } from "react";
import type { ProductWorkflowEdge, ProductWorkflowNode } from "@meeting-flow/shared";
import { WorkflowInspectorEditor } from "../WorkflowCanvasInspector";
import { WorkflowEdgeConfigPanel } from "./WorkflowEdgeConfigPanel";

const CONFIG_COLLAPSED_KEY = "workflow-config-collapsed";

type WorkflowNodeConfigPanelProps = {
  canvasNodes: ProductWorkflowNode[];
  isCanvasDirty: boolean;
  isWorkflowActionBusy: boolean;
  onClearSelection: () => void;
  onDeleteSelectedEdge: () => void;
  onDeleteSelectedNode: () => void;
  onOpenNodeAgent?: (templateId: string, nodeId: string) => void;
  onResetCanvas: () => void;
  onSaveCanvas: () => void;
  selectedEdge: ProductWorkflowEdge | null;
  selectedNode: ProductWorkflowNode | null;
  selectedTemplateId: string;
  updateCanvasEdge: (edgeId: string, update: (edge: ProductWorkflowEdge) => ProductWorkflowEdge) => void;
  updateCanvasNode: (nodeId: string, update: (node: ProductWorkflowNode) => ProductWorkflowNode) => void;
};

function readCollapsedPreference() {
  try {
    return window.sessionStorage.getItem(CONFIG_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function WorkflowNodeConfigPanel(props: WorkflowNodeConfigPanelProps) {
  const { onClearSelection, selectedEdge, selectedNode } = props;
  const hasSelection = Boolean(selectedNode || selectedEdge);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CONFIG_COLLAPSED_KEY, isCollapsed ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [isCollapsed]);

  function expandPanel() {
    setIsCollapsed(false);
  }

  function collapsePanel() {
    setIsCollapsed(true);
  }

  if (isCollapsed) {
    return (
      <aside
        className="workflow-editor__config workflow-editor__config--collapsed"
        aria-label="节点配置（已折叠）"
        data-testid="workflow-config-collapsed"
      >
        <button
          aria-expanded="false"
          aria-label="展开右侧配置"
          className="workflow-editor__config-rail"
          onClick={expandPanel}
          title="展开配置"
          type="button"
        >
          <span aria-hidden="true">‹</span>
          <strong>配置</strong>
          {hasSelection ? <em className="workflow-editor__config-rail-dot" aria-hidden="true" /> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className="workflow-editor__config" aria-label="节点配置" data-testid="workflow-config-panel">
      <div className="workflow-editor__config-head">
        <strong>{selectedEdge ? "连线配置" : selectedNode ? selectedNode.title : "配置"}</strong>
        <div className="workflow-editor__config-head-actions">
          {hasSelection ? (
            <button
              aria-label="清除选中"
              className="canvas-icon-button"
              onClick={onClearSelection}
              title="清除选中"
              type="button"
            >
              ×
            </button>
          ) : null}
          <button
            aria-expanded="true"
            aria-label="折叠右侧配置"
            className="ghost-button workflow-editor__config-toggle"
            onClick={collapsePanel}
            title="折叠配置"
            type="button"
          >
            收起
          </button>
        </div>
      </div>

      {hasSelection ? (
        selectedEdge ? (
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
          <WorkflowInspectorEditor
            {...props}
            onDeleteSelectedNode={props.onDeleteSelectedNode}
            variant="sidebar"
          />
        )
      ) : (
        <div className="workflow-editor__config-empty">
          <p>点击画布中的节点或连线</p>
          <small>在此编辑标题、参数与映射</small>
        </div>
      )}
    </aside>
  );
}

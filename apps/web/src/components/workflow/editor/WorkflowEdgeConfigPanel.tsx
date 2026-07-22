import { useEffect, useRef } from "react";
import type { ProductWorkflowEdge, ProductWorkflowNode } from "@meeting-flow/shared";
import { useWorkflowEditorStore } from "../../../stores/workflowEditorStore";
import { formatDataMapping, parseDataMapping } from "../workflowPanelUtils";

const conditionPresets = [
  "status === \"approved\"",
  "type === \"client\"",
  "priority === \"high\"",
  "contextPack.ready === true"
];

type WorkflowEdgeConfigPanelProps = {
  canvasNodes: ProductWorkflowNode[];
  isCanvasDirty: boolean;
  isWorkflowActionBusy: boolean;
  onDeleteSelectedEdge: () => void;
  onSaveCanvas: () => void;
  selectedEdge: ProductWorkflowEdge;
  updateCanvasEdge: (edgeId: string, update: (edge: ProductWorkflowEdge) => ProductWorkflowEdge) => void;
  variant?: "sidebar" | "floating";
};

export function WorkflowEdgeConfigPanel({
  canvasNodes,
  isCanvasDirty,
  isWorkflowActionBusy,
  onDeleteSelectedEdge,
  onSaveCanvas,
  selectedEdge,
  updateCanvasEdge,
  variant = "sidebar"
}: WorkflowEdgeConfigPanelProps) {
  const compact = variant === "floating";
  const conditionRef = useRef<HTMLTextAreaElement>(null);
  const focusedEdgeField = useWorkflowEditorStore((state) => state.focusedEdgeField);
  const setFocusedEdgeField = useWorkflowEditorStore((state) => state.setFocusedEdgeField);

  const sourceTitle = canvasNodes.find((node) => node.id === selectedEdge.source)?.title ?? selectedEdge.source;
  const targetTitle = canvasNodes.find((node) => node.id === selectedEdge.target)?.title ?? selectedEdge.target;
  const isConditional = Boolean(selectedEdge.condition?.trim());

  useEffect(() => {
    if (focusedEdgeField !== "condition") {
      return;
    }
    conditionRef.current?.focus();
    conditionRef.current?.select();
    setFocusedEdgeField(null);
  }, [focusedEdgeField, selectedEdge.id, setFocusedEdgeField]);

  function applyCondition(value: string) {
    updateCanvasEdge(selectedEdge.id, (edge) => ({
      ...edge,
      condition: value.trim() ? value : undefined
    }));
  }

  return (
    <div className={`ide-inspector__body scroll-area workflow-edge-config${compact ? " ide-inspector__body--compact" : ""}`}>
      <div className="workflow-edge-config__scroll">
        <div className="workflow-edge-config__route">
          <span>{sourceTitle}</span>
          <em aria-hidden="true">→</em>
          <span>{targetTitle}</span>
          {isConditional ? <strong className="workflow-edge-config__badge">条件边</strong> : null}
        </div>

        <div className="ide-form">
          <label>
            标签
            <input
              onChange={(event) => updateCanvasEdge(selectedEdge.id, (edge) => ({ ...edge, label: event.target.value }))}
              placeholder="例如：approved / fallback"
              value={selectedEdge.label}
            />
          </label>

          <label>
            条件表达式
            <textarea
              className="workflow-edge-config__condition"
              onChange={(event) => applyCondition(event.target.value)}
              placeholder='例如：type === "client" || priority === "high"'
              ref={conditionRef}
              rows={compact ? 3 : 4}
              value={selectedEdge.condition ?? ""}
            />
            <small className="ide-form__hint">双击连线可快速编辑条件。留空表示无条件路由。</small>
          </label>

          {!compact ? (
            <div className="workflow-edge-config__presets" aria-label="条件预设">
              {conditionPresets.map((preset) => (
                <button
                  className="workflow-edge-config__preset"
                  key={preset}
                  onClick={() => applyCondition(preset)}
                  type="button"
                >
                  {preset}
                </button>
              ))}
            </div>
          ) : null}

          {!compact ? (
            <label>
              数据映射
              <textarea
                onChange={(event) => {
                  const dataMapping = parseDataMapping(event.target.value);
                  updateCanvasEdge(selectedEdge.id, (edge) => ({
                    ...edge,
                    dataMapping: Object.keys(dataMapping).length > 0 ? dataMapping : undefined
                  }));
                }}
                placeholder="sourceField: targetField"
                value={formatDataMapping(selectedEdge.dataMapping)}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="ide-config-actions ide-config-actions--compact">
        <button className="danger-button" disabled={isWorkflowActionBusy} onClick={onDeleteSelectedEdge} type="button">
          删线
        </button>
        <button className="primary-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={() => void onSaveCanvas()} type="button">
          保存
        </button>
      </div>
    </div>
  );
}

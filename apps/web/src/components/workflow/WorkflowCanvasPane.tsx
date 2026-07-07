import { useRef, type DragEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import ReactFlow, {
  Background,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance
} from "reactflow";
import { meetingStatusLabels, type MeetingRecord, type ProductNodeRun, type ProductWorkflowNode, type ProductWorkflowRun, type ProductWorkflowTemplate } from "@meeting-flow/shared";
import { durationLabel, formatDateRange } from "../../lib/format";
import { FlowNode } from "./FlowNode";
import { WorkflowCanvasEditorToolbar } from "./WorkflowCanvasInspector";
import {
  nodeRunLabels,
  runStatusLabels,
  statusClass,
  toneByKind
} from "./workflowPanelUtils";
import type { WorkflowNodeData } from "./workflowPanelTypes";

const nodeTypes = { workflow: FlowNode };

type WorkflowCanvasPaneProps = {
  actionCount: number;
  availableRuns: ProductWorkflowRun[];
  blockedNodeRun?: ProductNodeRun;
  canvasNodes: ProductWorkflowNode[];
  canvasWrapperRef?: RefObject<HTMLDivElement>;
  isCanvasDirty: boolean;
  isCanvasEditMode: boolean;
  isCanvasZoomFocused: boolean;
  isWorkflowActionBusy: boolean;
  isWorkflowDetailOpen: boolean;
  isWorkflowMoreOpen: boolean;
  onAddNode: () => void;
  onAdvanceWorkflowRun: () => void;
  onConnect?: (connection: Connection) => void;
  onDeleteSelectedNode: () => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onEdgeClick: (event: ReactMouseEvent, edge: Edge) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onFlowInit?: (instance: ReactFlowInstance) => void;
  onNodeClick: (event: ReactMouseEvent, node: Node<WorkflowNodeData>) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onResetCanvas: () => void;
  onRetryWorkflowRun: () => void;
  onSaveCanvas: () => void;
  onSelectRun: (run: ProductWorkflowRun) => void;
  onSelectTemplate: (templateId: string) => void;
  onSetCanvasEditMode: (value: boolean) => void;
  onSetCanvasZoomFocused: (value: boolean) => void;
  onSetWorkflowDetailOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  onSetWorkflowMoreOpen: (value: boolean) => void;
  onStartWorkflowRun: () => void;
  selectedInputPayload: Array<{ key: string; value: string }>;
  selectedMeeting: MeetingRecord | null;
  selectedNode: ProductWorkflowNode | null;
  selectedNodeConfigSnapshot?: { configFields: Array<{ key: string; label: string; value: string }> };
  selectedNodeRun?: ProductNodeRun;
  selectedOutputPayload: Array<{ key: string; value: string }>;
  selectedRun: ProductWorkflowRun | null;
  selectedTemplate: ProductWorkflowTemplate;
  selectedTemplateId: string;
  setSelectedFlowNodeId: (nodeId: string) => void;
  selectedFlowNodeId: string;
  workflowEdges: Edge[];
  workflowNodes: Array<Node<WorkflowNodeData>>;
  workflowTemplates: ProductWorkflowTemplate[];
  isValidConnection: (connection: Connection) => boolean;
};

type WorkflowCanvasHeaderProps = Pick<
  WorkflowCanvasPaneProps,
  | "isCanvasDirty"
  | "isCanvasEditMode"
  | "isWorkflowDetailOpen"
  | "isWorkflowMoreOpen"
  | "onSetCanvasEditMode"
  | "onSetWorkflowDetailOpen"
  | "onSetWorkflowMoreOpen"
>;

export function WorkflowCanvasHeader(props: WorkflowCanvasHeaderProps) {
  const {
    isCanvasDirty,
    isCanvasEditMode,
    isWorkflowDetailOpen,
    isWorkflowMoreOpen,
    onSetCanvasEditMode,
    onSetWorkflowDetailOpen,
    onSetWorkflowMoreOpen
  } = props;

  const showRunView = !isCanvasEditMode && !isWorkflowDetailOpen && !isWorkflowMoreOpen;

  const openRunView = () => {
    onSetCanvasEditMode(false);
    onSetWorkflowDetailOpen(false);
    onSetWorkflowMoreOpen(false);
  };

  const modes = [
    { id: "run", label: "运行视图", active: showRunView, onClick: openRunView },
    { id: "edit", label: "编辑画布", active: isCanvasEditMode, onClick: () => { openRunView(); onSetCanvasEditMode(true); } },
    { id: "detail", label: "详情面板", active: isWorkflowDetailOpen, onClick: () => { openRunView(); onSetWorkflowDetailOpen(true); } },
    { id: "more", label: "拓展工具", active: isWorkflowMoreOpen, onClick: () => { openRunView(); onSetWorkflowMoreOpen(true); } }
  ] as const;

  return (
    <div className="ide-pane-header ide-pane-header--workflow workflow-shell__header workflow-shell__header--compact">
      <div className="workflow-title-block">
        <strong>流程画布</strong>
        <p className={isCanvasDirty ? "" : "is-placeholder"}>画布有未保存修改</p>
      </div>

      <div className="workflow-mode-switcher workflow-mode-switcher--quad" aria-label="流程视图模式">
        {modes.map((mode) => (
          <button
            aria-pressed={mode.active}
            className={`workflow-mode-switcher__button${mode.active ? " is-active" : ""}`}
            key={mode.id}
            onClick={mode.onClick}
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkflowCanvasPane(props: WorkflowCanvasPaneProps) {
  const {
    actionCount,
    availableRuns,
    blockedNodeRun,
    canvasNodes,
    canvasWrapperRef,
    isCanvasDirty,
    isCanvasEditMode,
    isCanvasZoomFocused,
    isWorkflowActionBusy,
    isWorkflowDetailOpen,
    isWorkflowMoreOpen,
    onAddNode,
    onAdvanceWorkflowRun,
    onConnect,
    onDeleteSelectedNode,
    onDragOver,
    onDrop,
    onEdgeClick,
    onEdgesChange,
    onFlowInit,
    onNodeClick,
    onNodesChange,
    onResetCanvas,
    onRetryWorkflowRun,
    onSaveCanvas,
    onSelectRun,
    onSelectTemplate,
    onSetCanvasZoomFocused,
    onStartWorkflowRun,
    selectedMeeting,
    selectedNode,
    selectedNodeRun,
    selectedRun,
    selectedTemplate,
    selectedTemplateId,
    setSelectedFlowNodeId,
    selectedFlowNodeId,
    workflowEdges,
    workflowNodes,
    workflowTemplates,
    isValidConnection
  } = props;

  const localCanvasRef = useRef<HTMLDivElement>(null);
  const canvasRef = canvasWrapperRef ?? localCanvasRef;

  return (
    <div className="ide-canvas-pane">
      <div className="ide-canvas-pane__body">
      {isCanvasEditMode && (
        <WorkflowCanvasEditorToolbar
          canvasNodes={canvasNodes}
          isCanvasDirty={isCanvasDirty}
          isWorkflowActionBusy={isWorkflowActionBusy}
          onAddNode={onAddNode}
          onDeleteSelectedNode={onDeleteSelectedNode}
          onResetCanvas={onResetCanvas}
          onSaveCanvas={onSaveCanvas}
          onSelectTemplate={onSelectTemplate}
          selectedNode={selectedNode}
          selectedTemplateId={selectedTemplateId}
          workflowTemplates={workflowTemplates}
        />
      )}

      {!isCanvasEditMode && !isWorkflowDetailOpen && !isWorkflowMoreOpen && (
        <div className="workflow-canvas-summary" aria-label="流程运行与当前会议">
          <div className="workflow-canvas-summary__main">
            {selectedNode && (
              <div className="ide-runtime-grid" aria-label="流程运行状态">
                <div><span>运行状态</span><strong>{selectedRun ? runStatusLabels[selectedRun.status] : "暂无运行"}</strong></div>
                <div><span>当前节点</span><strong>{selectedNodeRun ? nodeRunLabels[selectedNodeRun.status] : "未运行"}</strong></div>
                <div><span>行动项</span><strong>{actionCount} 项</strong></div>
              </div>
            )}

            <section className="ide-current-meeting" aria-label="当前会议">
              <span>当前会议</span>
              {selectedMeeting ? (
                <>
                  <strong>{selectedMeeting.title}</strong>
                  <p>{meetingStatusLabels[selectedMeeting.status]} / {durationLabel(selectedMeeting.durationMinutes)}</p>
                  <small>{formatDateRange(selectedMeeting.startAt, selectedMeeting.endAt)}</small>
                </>
              ) : (
                <>
                  <strong>未选择会议</strong>
                  <p>选择会议后可运行模板并同步日历。</p>
                </>
              )}
            </section>
          </div>

          {!isWorkflowDetailOpen && !isWorkflowMoreOpen && (
            <div className="workflow-run-actions workflow-run-actions--summary" aria-label="流程运行操作">
              <button className="ghost-button" disabled={!selectedRun || isWorkflowActionBusy} onClick={() => void onRetryWorkflowRun()} type="button">
                重新运行
              </button>
              <button
                className="primary-button"
                disabled={!selectedMeeting || !selectedTemplate || isWorkflowActionBusy}
                onClick={() => void (blockedNodeRun ? onAdvanceWorkflowRun() : onStartWorkflowRun())}
                type="button"
              >
                {blockedNodeRun ? "继续流程" : "启动流程"}
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={`canvas workflow-canvas ide-canvas${isCanvasZoomFocused ? " is-zoom-focused" : ""}`}
        onBlur={() => onSetCanvasZoomFocused(false)}
        onClick={() => onSetCanvasZoomFocused(true)}
        onFocus={() => onSetCanvasZoomFocused(true)}
        onMouseLeave={() => onSetCanvasZoomFocused(false)}
        ref={canvasRef}
        tabIndex={0}
      >
        <ReactFlow
          connectionLineStyle={{ stroke: "#8fc0c5", strokeWidth: 2, strokeDasharray: "5 5" }}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: false,
            style: { strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#94a3b8" }
          }}
          deleteKeyCode={isCanvasEditMode ? ["Backspace", "Delete"] : []}
          edges={workflowEdges}
          edgesFocusable
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.55, maxZoom: 0.95 }}
          isValidConnection={isValidConnection}
          nodes={workflowNodes}
          nodesConnectable={isCanvasEditMode}
          nodesDraggable={isCanvasEditMode}
          nodeTypes={nodeTypes}
          onConnect={isCanvasEditMode ? onConnect : undefined}
          onDragOver={isCanvasEditMode ? onDragOver : undefined}
          onDrop={isCanvasEditMode ? onDrop : undefined}
          onEdgeClick={onEdgeClick}
          onEdgesChange={onEdgesChange}
          onInit={(instance) => onFlowInit?.(instance)}
          onNodeClick={onNodeClick}
          onNodesChange={onNodesChange}
          preventScrolling={isCanvasZoomFocused}
          snapGrid={[16, 16]}
          snapToGrid
          zoomOnScroll={isCanvasZoomFocused}
        >
          <Panel position="top-left">
            <div className="canvas-pill ide-pill">
              {selectedRun
                ? `${runStatusLabels[selectedRun.status]} / ${selectedRun.durationSeconds}s / ${selectedTemplate.status}`
                : `暂无运行记录 / ${selectedTemplate.status}`}
            </div>
          </Panel>
          <Controls showInteractive={false} />
          {isCanvasEditMode && (
            <MiniMap
              maskColor="rgba(0,0,0,0.08)"
              nodeColor={(node) => toneByKind[(node.data as WorkflowNodeData).kind] ?? "#64748b"}
              nodeStrokeColor="#94a3b8"
              style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          )}
          <Background color="#e5e7eb" gap={24} />
        </ReactFlow>
      </div>

      {!isCanvasEditMode && (
      <div className="runs-panel" aria-label="运行记录">
        <div className="runs-panel__list">
          {availableRuns.length > 0 ? (
            availableRuns.map((run) => (
              <button
                className={`run-row ${run.id === selectedRun?.id ? "is-active" : ""}`}
                key={run.id}
                onClick={() => onSelectRun(run)}
                type="button"
              >
                <span className={`run-status ${statusClass(run.status)}`}>{runStatusLabels[run.status]}</span>
                <strong>{run.name}</strong>
                <small>{run.durationSeconds}s</small>
              </button>
            ))
          ) : (
            <div className="run-empty">暂无运行记录</div>
          )}
        </div>

        {isWorkflowDetailOpen && (
          <div className="ide-run-log runs-panel__logs">
            {selectedRun ? (
              selectedRun.logs.map((log) => (
                <button
                  className={`ide-run-log__row ide-run-log__row--${log.level}${log.nodeId === selectedFlowNodeId ? " is-active" : ""}`}
                  disabled={!log.nodeId}
                  key={log.id}
                  onClick={() => { if (log.nodeId) setSelectedFlowNodeId(log.nodeId); }}
                  type="button"
                >
                  <span>{log.time}</span>
                  <code>{log.message}</code>
                </button>
              ))
            ) : (
              <div className="run-empty run-empty--log">等待首次运行</div>
            )}
          </div>
        )}
      </div>
      )}
      </div>
    </div>
  );
}

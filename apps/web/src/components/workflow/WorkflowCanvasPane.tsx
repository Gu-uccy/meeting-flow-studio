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

export function WorkflowCanvasPane(props: WorkflowCanvasPaneProps) {
  const {
    actionCount,
    availableRuns,
    blockedNodeRun,
    canvasWrapperRef,
    isCanvasDirty,
    isCanvasEditMode,
    isCanvasZoomFocused,
    isWorkflowActionBusy,
    isWorkflowDetailOpen,
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
    onSetCanvasEditMode,
    onSetCanvasZoomFocused,
    onSetWorkflowDetailOpen,
    onStartWorkflowRun,
    selectedInputPayload,
    selectedMeeting,
    selectedNode,
    selectedNodeConfigSnapshot,
    selectedNodeRun,
    selectedOutputPayload,
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
      <div className="ide-pane-header ide-pane-header--workflow">
        <div className="workflow-title-block">
          <strong>流程画布</strong>
          {isCanvasDirty && <p>画布有未保存修改</p>}
        </div>

        <div className="workflow-mode-switcher" aria-label="流程视图模式">
          <button
            className={!isCanvasEditMode && !isWorkflowDetailOpen ? "primary-button" : "ghost-button"}
            onClick={() => { onSetWorkflowDetailOpen(false); onSetCanvasEditMode(false); }}
            type="button"
          >
            运行视图
          </button>
          <button
            className={isCanvasEditMode ? "primary-button" : "ghost-button"}
            onClick={() => { onSetWorkflowDetailOpen(false); onSetCanvasEditMode(true); }}
            type="button"
          >
            编辑画布
          </button>
          <button
            className={isWorkflowDetailOpen ? "primary-button" : "ghost-button"}
            onClick={() => { onSetCanvasEditMode(false); onSetWorkflowDetailOpen((current) => !current); }}
            type="button"
          >
            {isWorkflowDetailOpen ? "关闭详情" : "详情面板"}
          </button>
        </div>

        <div className="workflow-header-actions">
          {!isCanvasEditMode && !isWorkflowDetailOpen && (
            <div className="workflow-run-actions" aria-label="流程运行操作">
              {selectedRun && (
                <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onRetryWorkflowRun()} type="button">
                  重新运行
                </button>
              )}
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

          {isCanvasEditMode && (
            <div className="canvas-editor-actions" aria-label="画布编辑">
              <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onAddNode} type="button">添加节点</button>
              <button className="ghost-button" disabled={isWorkflowActionBusy || !selectedNode || props.canvasNodes.length <= 1} onClick={onDeleteSelectedNode} type="button">删除节点</button>
              <button className="ghost-button" disabled={isWorkflowActionBusy || !isCanvasDirty} onClick={onResetCanvas} type="button">撤销修改</button>
              <button className="primary-button" disabled={isWorkflowActionBusy || !isCanvasDirty} onClick={() => void onSaveCanvas()} type="button">保存画布</button>
            </div>
          )}
        </div>

        {isCanvasEditMode && (
          <WorkflowCanvasEditorToolbar
            onSelectTemplate={onSelectTemplate}
            selectedTemplateId={selectedTemplateId}
            workflowTemplates={workflowTemplates}
          />
        )}
      </div>

      <div className="workflow-canvas-summary" aria-label="流程运行与当前会议">
        {selectedNode && (
          <>
            {isCanvasEditMode && (
              <div className="node-payload">
                <section>
                  <span>本次运行</span>
                  <div>
                    <code>{selectedRun ? runStatusLabels[selectedRun.status] : "暂无运行"}</code>
                    <code>{selectedNodeRun ? nodeRunLabels[selectedNodeRun.status] : "节点未运行"}</code>
                    <code>{selectedRun ? `${selectedRun.durationSeconds}s` : "0s"}</code>
                  </div>
                </section>
                <section>
                  <span>输入</span>
                  <div>
                    {selectedInputPayload.length > 0 ? selectedInputPayload.map((item) => <code key={item.key}>{item.key}: {item.value}</code>) : <code>暂无输入</code>}
                  </div>
                </section>
                <section>
                  <span>输出</span>
                  <div>
                    {selectedOutputPayload.length > 0 ? selectedOutputPayload.map((item) => <code key={item.key}>{item.key}: {item.value}</code>) : <code>暂无输出</code>}
                  </div>
                </section>
                <section>
                  <span>运行配置快照</span>
                  <div>
                    {selectedNodeConfigSnapshot?.configFields.length ? (
                      selectedNodeConfigSnapshot.configFields.map((field) => <code key={field.key}>{field.label}: {field.value}</code>)
                    ) : (
                      <code>使用当前节点配置</code>
                    )}
                  </div>
                </section>
                {selectedNodeRun?.errorMessage && (
                  <section className="node-payload__error">
                    <span>异常</span>
                    <p>{selectedNodeRun.errorMessage}</p>
                  </section>
                )}
              </div>
            )}

            <div className="ide-runtime-grid" aria-label="流程运行状态">
              <div><span>运行状态</span><strong>{selectedRun ? runStatusLabels[selectedRun.status] : "暂无运行"}</strong></div>
              <div><span>当前节点</span><strong>{selectedNodeRun ? nodeRunLabels[selectedNodeRun.status] : "未运行"}</strong></div>
              <div><span>行动项</span><strong>{actionCount} 项</strong></div>
            </div>
          </>
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
          fitViewOptions={{ padding: 0.3 }}
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
    </div>
  );
}

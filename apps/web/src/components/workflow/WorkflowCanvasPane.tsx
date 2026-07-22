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
import {
  meetingStatusLabels,
  type MeetingRecord,
  type ProductWorkflowRun
} from "@meeting-flow/shared";
import { formatDateRange } from "../../lib/format";
import { workflowNodeTypes } from "./nodes";
import { WorkflowCanvasEditorToolbar } from "./WorkflowCanvasInspector";
import { runStatusLabels, toneByKind, workflowCanvasFitViewOptions, workflowCanvasZoomBounds } from "./workflowPanelUtils";
import type { WorkflowNodeData } from "./workflowPanelTypes";

const nodeTypes = workflowNodeTypes;

type WorkflowCanvasPaneProps = {
  canvasWrapperRef?: RefObject<HTMLDivElement>;
  isCanvasEmpty?: boolean;
  isCanvasZoomFocused: boolean;
  isValidConnection: (connection: Connection) => boolean;
  onAddNode?: () => void;
  onConnect?: (connection: Connection) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onEdgeClick: (event: ReactMouseEvent, edge: Edge) => void;
  onEdgeDoubleClick?: (event: ReactMouseEvent, edge: Edge) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onFlowInit?: (instance: ReactFlowInstance) => void;
  onNodeClick: (event: ReactMouseEvent, node: Node<WorkflowNodeData>) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onPaneClick?: () => void;
  onSetCanvasZoomFocused: (value: boolean) => void;
  readOnly?: boolean;
  selectedMeeting: MeetingRecord | null;
  selectedRun: ProductWorkflowRun | null;
  workflowEdges: Edge[];
  workflowNodes: Array<Node<WorkflowNodeData>>;
};

export function WorkflowCanvasPane(props: WorkflowCanvasPaneProps) {
  const {
    canvasWrapperRef,
    isCanvasEmpty = false,
    isCanvasZoomFocused,
    isValidConnection,
    onAddNode,
    onConnect,
    onDragOver,
    onDrop,
    onEdgeClick,
    onEdgeDoubleClick,
    onEdgesChange,
    onFlowInit,
    onNodeClick,
    onNodesChange,
    onPaneClick,
    onSetCanvasZoomFocused,
    readOnly = false,
    selectedMeeting,
    selectedRun,
    workflowEdges,
    workflowNodes
  } = props;

  const localCanvasRef = useRef<HTMLDivElement>(null);
  const canvasRef = canvasWrapperRef ?? localCanvasRef;

  return (
    <div
      className={`canvas workflow-canvas ide-canvas ide-canvas--full${isCanvasZoomFocused ? " is-zoom-focused" : ""}`}
      onBlur={() => onSetCanvasZoomFocused(false)}
      onClick={() => onSetCanvasZoomFocused(true)}
      onFocus={() => onSetCanvasZoomFocused(true)}
      onMouseLeave={() => onSetCanvasZoomFocused(false)}
      ref={canvasRef}
      tabIndex={0}
    >
      <div className="canvas-flow-host">
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
          deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
          edges={workflowEdges}
          edgesFocusable={!readOnly}
          elementsSelectable
          fitViewOptions={workflowCanvasFitViewOptions}
          isValidConnection={readOnly ? () => false : isValidConnection}
          minZoom={workflowCanvasZoomBounds.minZoom}
          maxZoom={workflowCanvasZoomBounds.maxZoom}
          nodes={workflowNodes}
          nodesConnectable={!readOnly}
          nodesDraggable={!readOnly}
          nodeTypes={nodeTypes}
          onConnect={readOnly ? undefined : onConnect}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          onEdgeClick={onEdgeClick}
          onEdgeDoubleClick={readOnly ? undefined : onEdgeDoubleClick}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onInit={(instance) => onFlowInit?.(instance)}
          onNodeClick={onNodeClick}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onPaneClick={onPaneClick}
          preventScrolling={isCanvasZoomFocused}
          snapGrid={[16, 16]}
          snapToGrid
          style={{ height: "100%", width: "100%" }}
          zoomOnScroll={isCanvasZoomFocused}
        >
          <Panel position="top-left">
            {selectedMeeting ? (
              <div className="canvas-meeting-chip" aria-label="当前会议">
                <strong>{selectedMeeting.title}</strong>
                <span>{meetingStatusLabels[selectedMeeting.status]}</span>
                <small>{formatDateRange(selectedMeeting.startAt, selectedMeeting.endAt)}</small>
                {selectedRun ? <em>{runStatusLabels[selectedRun.status]}</em> : null}
              </div>
            ) : null}
          </Panel>

          {isCanvasEmpty ? (
            <Panel className="workflow-canvas-empty" position="top-center">
              <strong>画布为空</strong>
              <p>{readOnly ? "当前模板还没有配置节点。" : "从左侧节点库拖拽节点到画布，或点击下方按钮添加第一个节点。"}</p>
              {!readOnly && onAddNode ? (
                <button className="primary-button" onClick={onAddNode} type="button">
                  添加节点
                </button>
              ) : null}
            </Panel>
          ) : null}

          <Controls showInteractive={false} />
          <MiniMap
            maskColor="rgba(0,0,0,0.06)"
            nodeColor={(node) => toneByKind[(node.data as WorkflowNodeData).kind] ?? "#64748b"}
            nodeStrokeColor="#94a3b8"
            pannable
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, height: 56, width: 88 }}
            zoomable
          />
          <Background color="#dfe7ec" gap={16} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}

export { WorkflowCanvasEditorToolbar };

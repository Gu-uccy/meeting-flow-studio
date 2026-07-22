import { useCallback, useEffect, useMemo, useRef, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  applyNodeChanges,
  MarkerType,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance
} from "reactflow";
import type {
  MeetingRecord,
  ProductWorkflowEdge,
  ProductWorkflowNode,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";
import type { WorkflowNodeData } from "../components/workflow/workflowPanelTypes";
import {
  buildDroppedNode,
  createCanvasNode,
  formatPayload,
  getEdgeState,
  getFallbackRun,
  getFeaturedNodeId,
  getTemplateForMeeting,
  nodeRunStateMap,
  workflowCanvasFitViewOptions
} from "../components/workflow/workflowPanelUtils";
import { useWorkflowCanvasStore } from "../stores/workflowCanvasStore";
import { useWorkflowEditorStore } from "../stores/workflowEditorStore";
import { useWorkflowExecutionStore } from "../stores/workflowExecutionStore";

export type UseWorkflowCanvasControllerOptions = {
  selectedMeeting: MeetingRecord | null;
  workflowTemplates: ProductWorkflowTemplate[];
  workflowRuns: ProductWorkflowRun[];
  canvasFocusRun?: {
    runId: string;
    templateId: string;
    meetingId: string;
  } | null;
  onCanvasFocusApplied?: () => void;
  onSaveTemplateCanvas: (
    templateId: string,
    nodes: ProductWorkflowNode[],
    edges: ProductWorkflowEdge[]
  ) => Promise<ProductWorkflowTemplate | null>;
  onStartWorkflowRun: (templateId: string) => Promise<ProductWorkflowRun | null>;
  onAdvanceWorkflowRun: (runId: string, resolutionNote: string) => Promise<ProductWorkflowRun | null>;
  onRetryWorkflowRun: (runId: string) => Promise<ProductWorkflowRun | null>;
  onCancelWorkflowRun: (runId: string) => Promise<ProductWorkflowRun | null>;
};

export function useWorkflowCanvasController({
  selectedMeeting,
  workflowTemplates,
  workflowRuns,
  canvasFocusRun,
  onCanvasFocusApplied,
  onSaveTemplateCanvas,
  onStartWorkflowRun,
  onAdvanceWorkflowRun,
  onRetryWorkflowRun,
  onCancelWorkflowRun
}: UseWorkflowCanvasControllerOptions) {
  const canvasNodes = useWorkflowCanvasStore((state) => state.canvasNodes);
  const canvasEdges = useWorkflowCanvasStore((state) => state.canvasEdges);
  const isCanvasDirty = useWorkflowCanvasStore((state) => state.isCanvasDirty);
  const selectedEdgeId = useWorkflowCanvasStore((state) => state.selectedEdgeId);
  const editorTarget = useWorkflowCanvasStore((state) => state.editorTarget);
  const loadCanvas = useWorkflowCanvasStore((state) => state.loadCanvas);
  const markCanvasSaved = useWorkflowCanvasStore((state) => state.markCanvasSaved);
  const setCanvasDirty = useWorkflowCanvasStore((state) => state.setCanvasDirty);
  const setCanvasEdges = useWorkflowCanvasStore((state) => state.setCanvasEdges);
  const setCanvasNodes = useWorkflowCanvasStore((state) => state.setCanvasNodes);
  const setEditorTarget = useWorkflowCanvasStore((state) => state.setEditorTarget);
  const setSelectedEdgeId = useWorkflowCanvasStore((state) => state.setSelectedEdgeId);
  const clearEditorSelection = useWorkflowCanvasStore((state) => state.clearEditorSelection);

  const selectedTemplateId = useWorkflowExecutionStore((state) => state.selectedTemplateId);
  const selectedRunId = useWorkflowExecutionStore((state) => state.selectedRunId);
  const selectedFlowNodeId = useWorkflowExecutionStore((state) => state.selectedFlowNodeId);
  const resolutionNote = useWorkflowExecutionStore((state) => state.resolutionNote);
  const isRunDetailOpen = useWorkflowExecutionStore((state) => state.isRunDetailOpen);
  const runStatusFilter = useWorkflowExecutionStore((state) => state.runStatusFilter);
  const setResolutionNote = useWorkflowExecutionStore((state) => state.setResolutionNote);
  const setRunDetailOpen = useWorkflowExecutionStore((state) => state.setRunDetailOpen);
  const setRunStatusFilter = useWorkflowExecutionStore((state) => state.setRunStatusFilter);
  const setSelectedFlowNodeId = useWorkflowExecutionStore((state) => state.setSelectedFlowNodeId);
  const setSelectedRunId = useWorkflowExecutionStore((state) => state.setSelectedRunId);
  const setSelectedTemplateId = useWorkflowExecutionStore((state) => state.setSelectedTemplateId);

  const isCanvasZoomFocused = useWorkflowEditorStore((state) => state.isCanvasZoomFocused);
  const setCanvasZoomFocused = useWorkflowEditorStore((state) => state.setCanvasZoomFocused);
  const setFocusedEdgeField = useWorkflowEditorStore((state) => state.setFocusedEdgeField);

  const lastAutoMatchedMeetingId = useRef<string | null>(null);
  const lastFittedTemplateId = useRef<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const fitCanvasToContent = useCallback(() => {
    const instance = reactFlowInstance.current;
    if (!instance) {
      return;
    }

    instance.fitView(workflowCanvasFitViewOptions);
    requestAnimationFrame(() => {
      const viewport = instance.getViewport();
      instance.setViewport(
        { ...viewport, y: viewport.y + 72 },
        { duration: 0 }
      );
    });
  }, []);

  const handleFlowInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    requestAnimationFrame(() => fitCanvasToContent());
  }, [fitCanvasToContent]);

  const suggestedTemplate = getTemplateForMeeting(workflowTemplates, selectedMeeting);
  const selectedTemplate = workflowTemplates.find((template) => template.id === selectedTemplateId) ?? suggestedTemplate;

  const availableRuns = useMemo(
    () => (selectedTemplate ? workflowRuns.filter((run) => run.templateId === selectedTemplate.id) : []),
    [selectedTemplate, workflowRuns]
  );

  const filteredRuns = useMemo(
    () => (runStatusFilter === "all" ? availableRuns : availableRuns.filter((run) => run.status === runStatusFilter)),
    [availableRuns, runStatusFilter]
  );

  const selectedRun = availableRuns.find((run) => run.id === selectedRunId)
    ?? (selectedTemplate ? getFallbackRun(workflowRuns, selectedTemplate.id, selectedMeeting?.id) : null);

  const selectedEdge = canvasEdges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedNode = selectedEdge
    ? null
    : canvasNodes.find((node) => node.id === selectedFlowNodeId) ?? canvasNodes[1] ?? canvasNodes[0] ?? null;
  const editorNode = editorTarget?.kind === "node"
    ? canvasNodes.find((node) => node.id === editorTarget.id) ?? null
    : null;
  const editorEdge = editorTarget?.kind === "edge"
    ? canvasEdges.find((edge) => edge.id === editorTarget.id) ?? null
    : null;

  const selectedNodeRun = selectedNode ? selectedRun?.nodeRuns.find((run) => run.nodeId === selectedNode.id) : undefined;
  const selectedNodeConfigSnapshot = selectedNode
    ? selectedRun?.configSnapshot?.find((snapshot) => snapshot.nodeId === selectedNode.id)
    : undefined;

  const selectedInputPayload = formatPayload(selectedNodeRun?.inputPayload);
  const selectedOutputPayload = formatPayload(selectedNodeRun?.outputPayload);
  const blockedNodeRun = selectedRun?.nodeRuns.find((run) => run.status === "blocked");

  useEffect(() => {
    if (!canvasFocusRun || selectedMeeting?.id !== canvasFocusRun.meetingId) {
      return;
    }

    const focusedTemplate = workflowTemplates.find((item) => item.id === canvasFocusRun.templateId);
    if (!focusedTemplate) {
      return;
    }

    const focusedRun = workflowRuns.find((run) => run.id === canvasFocusRun.runId) ?? null;
    setSelectedTemplateId(canvasFocusRun.templateId);
    setSelectedRunId(canvasFocusRun.runId);
    setSelectedFlowNodeId(getFeaturedNodeId(focusedRun, focusedTemplate));
    onCanvasFocusApplied?.();
  }, [canvasFocusRun, onCanvasFocusApplied, selectedMeeting?.id, setSelectedFlowNodeId, setSelectedRunId, setSelectedTemplateId, workflowRuns, workflowTemplates]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    loadCanvas(selectedTemplate.nodes, selectedTemplate.edges);
  }, [loadCanvas, selectedTemplate?.id, selectedTemplate?.updatedAt, selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate?.id || canvasNodes.length === 0) {
      return;
    }
    if (lastFittedTemplateId.current === selectedTemplate.id) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      fitCanvasToContent();
      lastFittedTemplateId.current = selectedTemplate.id;
    });
    return () => cancelAnimationFrame(frame);
  }, [canvasNodes.length, fitCanvasToContent, selectedTemplate?.id]);

  useEffect(() => {
    if (!selectedTemplate || workflowTemplates.some((template) => template.id === selectedTemplateId)) {
      return;
    }
    setSelectedTemplateId(selectedTemplate.id);
  }, [selectedTemplate, selectedTemplateId, setSelectedTemplateId, workflowTemplates]);

  useEffect(() => {
    const meetingId = selectedMeeting?.id ?? "";
    if (!suggestedTemplate || lastAutoMatchedMeetingId.current === meetingId) {
      return;
    }
    lastAutoMatchedMeetingId.current = meetingId;
    const nextRun = getFallbackRun(workflowRuns, suggestedTemplate.id, selectedMeeting?.id);
    setSelectedTemplateId(suggestedTemplate.id);
    setSelectedRunId(nextRun?.id ?? "");
    setSelectedFlowNodeId(getFeaturedNodeId(nextRun, suggestedTemplate));
  }, [selectedMeeting?.id, setSelectedFlowNodeId, setSelectedRunId, setSelectedTemplateId, suggestedTemplate, workflowRuns]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedRunId("");
      return;
    }
    const nextRun = getFallbackRun(workflowRuns, selectedTemplate.id, selectedMeeting?.id);
    const currentId = useWorkflowExecutionStore.getState().selectedRunId;
    setSelectedRunId(
      currentId && availableRuns.some((run) => run.id === currentId) ? currentId : nextRun?.id ?? ""
    );
  }, [availableRuns, selectedMeeting?.id, selectedTemplate, setSelectedRunId, workflowRuns]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedFlowNodeId("");
      return;
    }
    const currentId = useWorkflowExecutionStore.getState().selectedFlowNodeId;
    setSelectedFlowNodeId(
      currentId && canvasNodes.some((node) => node.id === currentId) ? currentId : canvasNodes[1]?.id ?? canvasNodes[0]?.id ?? ""
    );
  }, [canvasNodes, selectedTemplate, setSelectedFlowNodeId]);

  const workflowNodes = useMemo<Array<Node<WorkflowNodeData>>>(
    () => canvasNodes.map((node) => {
      const nodeRun = selectedRun?.nodeRuns.find((run) => run.nodeId === node.id);
      return {
        id: node.id,
        type: node.kind,
        position: node.position,
        selected: node.id === selectedFlowNodeId,
        data: {
          title: node.title,
          summary: node.description,
          kind: node.kind,
          state: nodeRun ? nodeRunStateMap[nodeRun.status] : "waiting",
          owner: node.owner
        }
      };
    }),
    [canvasNodes, selectedFlowNodeId, selectedRun]
  );

  const workflowEdges = useMemo<Edge[]>(
    () => canvasEdges.map((edge) => {
      const state = getEdgeState(edge.source, edge.target, selectedRun);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: state === "running",
        type: "smoothstep",
        label: edge.condition ?? edge.label,
        className: `workflow-edge workflow-edge--${state}${edge.condition ? " workflow-edge--conditional" : ""}${edge.id === selectedEdgeId ? " is-selected" : ""}`,
        selected: edge.id === selectedEdgeId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: state === "done" ? "#8fc0c5" : state === "blocked" ? "#dc2626" : state === "running" ? "#8fc0c5" : "#94a3b8"
        },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 6,
        labelStyle: { fill: "#374151", fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: "#ffffff", stroke: "#e5e7eb" },
        style: { strokeWidth: state === "blocked" ? 2.5 : 2 }
      };
    }),
    [canvasEdges, selectedEdgeId, selectedRun]
  );

  function selectTemplate(templateId: string) {
    const nextTemplate = workflowTemplates.find((template) => template.id === templateId) ?? workflowTemplates[0];
    if (!nextTemplate) return;
    const nextRun = getFallbackRun(workflowRuns, nextTemplate.id, selectedMeeting?.id);
    setSelectedTemplateId(nextTemplate.id);
    setSelectedRunId(nextRun?.id ?? "");
    setSelectedFlowNodeId(getFeaturedNodeId(nextRun, nextTemplate));
  }

  function selectRun(run: ProductWorkflowRun) {
    if (!selectedTemplate) return;
    setSelectedRunId(run.id);
    setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));
  }

  function handleNodeClick(_event: ReactMouseEvent, node: Node<WorkflowNodeData>) {
    setSelectedFlowNodeId(node.id);
    setSelectedEdgeId("");
    setEditorTarget({ kind: "node", id: node.id });
  }

  function handleEdgeClick(_event: ReactMouseEvent, edge: Edge) {
    setSelectedEdgeId(edge.id);
    setSelectedFlowNodeId("");
    setEditorTarget({ kind: "edge", id: edge.id });
  }

  function handleEdgeDoubleClick(_event: ReactMouseEvent, edge: Edge) {
    handleEdgeClick(_event, edge);
    setFocusedEdgeField("condition");
  }

  function handlePaneClick() {
    clearEditorSelection();
  }

  function handleNodesChange(changes: NodeChange[]) {
    const hasCanvasChange = changes.some((change) => change.type === "position" || change.type === "remove");
    if (!hasCanvasChange) return;

    const nextFlowNodes = applyNodeChanges(changes, workflowNodes);
    const nextNodeIds = new Set(nextFlowNodes.map((node) => node.id));

    setCanvasNodes((currentNodes) =>
      currentNodes
        .filter((node) => nextNodeIds.has(node.id))
        .map((node) => {
          const flowNode = nextFlowNodes.find((item) => item.id === node.id);
          return flowNode ? { ...node, position: flowNode.position } : node;
        })
    );
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => nextNodeIds.has(edge.source) && nextNodeIds.has(edge.target)));
    const currentFlowNodeId = useWorkflowExecutionStore.getState().selectedFlowNodeId;
    setSelectedFlowNodeId(currentFlowNodeId && nextNodeIds.has(currentFlowNodeId) ? currentFlowNodeId : nextFlowNodes[0]?.id ?? "");
    setCanvasDirty(true);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    const removedEdgeIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removedEdgeIds.size === 0) return;
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => !removedEdgeIds.has(edge.id)));
    setCanvasDirty(true);
  }

  function isValidConnection(connection: Connection) {
    if (connection.source === connection.target) return false;
    return !canvasEdges.some((edge) => edge.source === connection.source && edge.target === connection.target);
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || !isValidConnection(connection)) return;
    const edgeId = `${connection.source}-${connection.target}-${Date.now()}`;
    setCanvasEdges((currentEdges) => [...currentEdges, { id: edgeId, source: connection.source ?? "", target: connection.target ?? "", label: "" }]);
    setSelectedEdgeId(edgeId);
    setCanvasDirty(true);
  }

  function handleAddNode() {
    const node = createCanvasNode(canvasNodes.length + 1, {
      x: 120 + canvasNodes.length * 80,
      y: 120 + (canvasNodes.length % 3) * 80
    });
    setCanvasNodes((currentNodes) => [...currentNodes, node]);
    setSelectedFlowNodeId(node.id);
    setSelectedEdgeId("");
    setEditorTarget({ kind: "node", id: node.id });
    setCanvasDirty(true);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const kind = event.dataTransfer.getData("application/reactflow-kind") as ProductWorkflowNode["kind"] | "";
    if (!kind || !reactFlowInstance.current || !reactFlowWrapper.current) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.current.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });

    const newNode = buildDroppedNode(kind, position);
    setCanvasNodes((currentNodes) => [...currentNodes, newNode]);
    setSelectedFlowNodeId(newNode.id);
    setSelectedEdgeId("");
    setEditorTarget({ kind: "node", id: newNode.id });
    setCanvasDirty(true);
  }

  function handleDeleteSelectedNode() {
    const target = editorNode ?? selectedNode;
    if (!target || canvasNodes.length <= 1) return;
    setCanvasNodes((currentNodes) => currentNodes.filter((node) => node.id !== target.id));
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== target.id && edge.target !== target.id));
    setSelectedFlowNodeId(canvasNodes.find((node) => node.id !== target.id)?.id ?? "");
    clearEditorSelection();
    setCanvasDirty(true);
  }

  function handleDeleteSelectedEdge() {
    const target = editorEdge ?? selectedEdge;
    if (!target) return;
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== target.id));
    clearEditorSelection();
    setCanvasDirty(true);
  }

  function updateCanvasNode(nodeId: string, update: (node: ProductWorkflowNode) => ProductWorkflowNode) {
    setCanvasNodes((currentNodes) => currentNodes.map((node) => (node.id === nodeId ? update(node) : node)));
    setCanvasDirty(true);
  }

  function updateCanvasEdge(edgeId: string, update: (edge: ProductWorkflowEdge) => ProductWorkflowEdge) {
    setCanvasEdges((currentEdges) => currentEdges.map((edge) => (edge.id === edgeId ? update(edge) : edge)));
    setCanvasDirty(true);
  }

  async function handleSaveCanvas() {
    if (!selectedTemplate) return;
    const template = await onSaveTemplateCanvas(selectedTemplate.id, canvasNodes, canvasEdges);
    if (template) {
      markCanvasSaved(template.nodes, template.edges);
    }
  }

  function handleResetCanvas() {
    if (!selectedTemplate) return;
    loadCanvas(selectedTemplate.nodes, selectedTemplate.edges);
  }

  async function handleStartWorkflowRun() {
    if (!selectedTemplate || !selectedMeeting) return;
    const run = await onStartWorkflowRun(selectedTemplate.id);
    if (run) {
      setSelectedRunId(run.id);
      setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));
      setResolutionNote("");
    }
  }

  async function handleAdvanceWorkflowRun() {
    if (!selectedRun || !selectedTemplate) return;
    const run = await onAdvanceWorkflowRun(selectedRun.id, resolutionNote.trim());
    if (run) {
      setSelectedRunId(run.id);
      setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));
      setResolutionNote("");
    }
  }

  async function handleRetryWorkflowRun() {
    if (!selectedRun || !selectedTemplate) return;
    const run = await onRetryWorkflowRun(selectedRun.id);
    if (run) {
      setSelectedRunId(run.id);
      setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));
    }
  }

  async function handleCancelWorkflowRun() {
    if (!selectedRun) return;
    const run = await onCancelWorkflowRun(selectedRun.id);
    if (run) setSelectedRunId(run.id);
  }

  return {
    availableRuns,
    blockedNodeRun,
    canvasEdges,
    canvasNodes,
    editorEdge,
    editorNode,
    filteredRuns,
    handleAddNode,
    handleAdvanceWorkflowRun,
    handleCancelWorkflowRun,
    handleConnect,
    handleDeleteSelectedEdge,
    handleDeleteSelectedNode,
    handleDragOver,
    handleDrop,
    handleEdgeClick,
    handleEdgeDoubleClick,
    handleEdgesChange,
    handleNodeClick,
    handlePaneClick,
    handleFlowInit,
    handleNodesChange,
    handleResetCanvas,
    handleRetryWorkflowRun,
    handleSaveCanvas,
    handleStartWorkflowRun,
    isCanvasDirty,
    isCanvasZoomFocused,
    isRunDetailOpen,
    isValidConnection,
    reactFlowInstance,
    reactFlowWrapper,
    resolutionNote,
    runStatusFilter,
    selectRun,
    selectTemplate,
    selectedEdge,
    selectedFlowNodeId,
    selectedInputPayload,
    selectedNode,
    selectedNodeConfigSnapshot,
    selectedNodeRun,
    selectedOutputPayload,
    selectedRun,
    selectedTemplate,
    selectedTemplateId,
    setCanvasZoomFocused,
    setRunDetailOpen,
    setRunStatusFilter,
    setResolutionNote,
    setSelectedFlowNodeId,
    updateCanvasEdge,
    updateCanvasNode,
    workflowEdges,
    workflowNodes
  };
}

import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
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
import type { ProductWorkflowEdge, ProductWorkflowNode, ProductWorkflowRun } from "@meeting-flow/shared";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { RunDetailDialog } from "./RunDetailDialog";
import { WorkflowCanvasInspector } from "./WorkflowCanvasInspector";
import { WorkflowCanvasPane } from "./WorkflowCanvasPane";
import { WorkflowSupportPanel } from "./WorkflowSupportPanel";
import type { WorkflowNodeData } from "./workflowPanelTypes";
import {
  buildDroppedNode,
  createCanvasNode,
  formatPayload,
  getEdgeState,
  getFallbackRun,
  getFeaturedNodeId,
  getNextMeetingStatus,
  getTemplateForMeeting,
  nodeRunStateMap
} from "./workflowPanelUtils";

export function WorkflowTemplatePanel() {
  const { agent, feishuCalendar, googleCalendar, meetings, memories, modals, workflow } = useWorkbench();

  const selectedMeeting = meetings.selectedMeeting;
  const isMutating = meetings.isMutating;
  const isWorkflowLoading = workflow.isLoading;
  const workflowError = workflow.error;
  const workflowFeedback = workflow.feedback;
  const isWorkflowMutating = workflow.isMutating;
  const workflowRuns = workflow.runs;
  const workflowTemplates = workflow.templates;
  const isGoogleCalendarConfigured = googleCalendar.isConfigured;
  const isCalendarLoading = googleCalendar.isLoading;
  const isCalendarMutating = googleCalendar.isMutating;
  const googleRedirectUri = googleCalendar.redirectUri;
  const calendarStatusMessage = googleCalendar.statusMessage;
  const isGoogleCalendarConnected = googleCalendar.isConnected;
  const isFeishuCalendarConfigured = feishuCalendar.isConfigured;
  const isFeishuCalendarConnected = feishuCalendar.isConnected;
  const isFeishuCalendarLoading = feishuCalendar.isLoading;
  const isFeishuCalendarMutating = feishuCalendar.isMutating;
  const feishuRedirectUri = feishuCalendar.redirectUri;
  const feishuCalendarStatusMessage = feishuCalendar.statusMessage;
  const meetingMemories = memories.items;
  const isMemoryLoading = memories.isLoading;
  const isMemoryMutating = memories.isMutating;
  const memoryError = memories.error;
  const agentRun = agent.agentRun;
  const agentError = agent.error;
  const isAgentRunning = agent.isRunning;
  const onDeleteMemory = memories.deleteMemory;
  const onUpdateMemory = memories.updateMemory;
  const onRunAgent = agent.runAgentAndReload;
  const onConnectGoogleCalendar = googleCalendar.connectGoogleCalendar;
  const onConnectFeishuCalendar = feishuCalendar.connectFeishuCalendar;
  const onOpenDetail = () => {
    if (selectedMeeting) modals.openDetail(selectedMeeting.id);
  };
  const onEditMeeting = () => {
    if (selectedMeeting) modals.openEdit(selectedMeeting.id);
  };
  const onSyncGoogleCalendar = () => (selectedMeeting ? googleCalendar.syncMeeting(selectedMeeting.id) : Promise.resolve(null));
  const onSyncFeishuCalendar = () => (selectedMeeting ? feishuCalendar.syncMeeting(selectedMeeting.id) : Promise.resolve(null));
  const onStartWorkflowRun = workflow.startRunForSelectedMeeting;
  const onAdvanceWorkflowRun = workflow.advanceRunAndReloadMemories;
  const onCancelWorkflowRun = workflow.cancelWorkflowRun;
  const onRetryWorkflowRun = workflow.retryRunAndReloadMemories;
  const onSaveTemplateCanvas = workflow.saveTemplateCanvas;
  const onUpdateStatus = meetings.updateMeetingStatus;

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [canvasNodes, setCanvasNodes] = useState<ProductWorkflowNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<ProductWorkflowEdge[]>([]);
  const [isCanvasDirty, setIsCanvasDirty] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [isRunDetailOpen, setIsRunDetailOpen] = useState(false);
  const [isCanvasZoomFocused, setIsCanvasZoomFocused] = useState(false);
  const [isCanvasEditMode, setIsCanvasEditMode] = useState(false);
  const [isWorkflowDetailOpen, setIsWorkflowDetailOpen] = useState(false);

  const lastAutoMatchedMeetingId = useRef<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const suggestedTemplate = getTemplateForMeeting(workflowTemplates, selectedMeeting);
  const canSyncFeishuCalendar = !isFeishuCalendarConfigured || isFeishuCalendarConnected;
  const canSyncGoogleCalendar = !isGoogleCalendarConfigured || isGoogleCalendarConnected;
  const selectedTemplate = workflowTemplates.find((template) => template.id === selectedTemplateId) ?? suggestedTemplate;

  const availableRuns = useMemo(
    () => (selectedTemplate ? workflowRuns.filter((run) => run.templateId === selectedTemplate.id) : []),
    [selectedTemplate, workflowRuns]
  );

  const selectedRun = availableRuns.find((run) => run.id === selectedRunId)
    ?? (selectedTemplate ? getFallbackRun(workflowRuns, selectedTemplate.id, selectedMeeting?.id) : null);

  const selectedEdge = canvasEdges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedNode = selectedEdge
    ? null
    : canvasNodes.find((node) => node.id === selectedFlowNodeId) ?? canvasNodes[1] ?? canvasNodes[0] ?? null;

  const selectedNodeRun = selectedNode ? selectedRun?.nodeRuns.find((run) => run.nodeId === selectedNode.id) : undefined;
  const selectedNodeConfigSnapshot = selectedNode
    ? selectedRun?.configSnapshot?.find((snapshot) => snapshot.nodeId === selectedNode.id)
    : undefined;

  const actionCount = selectedMeeting?.actionItems.length ?? 0;
  const selectedInputPayload = formatPayload(selectedNodeRun?.inputPayload);
  const selectedOutputPayload = formatPayload(selectedNodeRun?.outputPayload);
  const nextMeetingStatus = selectedMeeting ? getNextMeetingStatus(selectedMeeting.status) : null;
  const blockedNodeRun = selectedRun?.nodeRuns.find((run) => run.status === "blocked" || run.status === "failed");
  const isWorkflowActionBusy = isMutating || isWorkflowMutating || isCalendarMutating || isFeishuCalendarMutating || isAgentRunning;

  useEffect(() => {
    setCanvasNodes(selectedTemplate?.nodes.map((node) => ({ ...node })) ?? []);
    setCanvasEdges(selectedTemplate?.edges.map((edge) => ({ ...edge })) ?? []);
    setSelectedEdgeId("");
    setIsCanvasDirty(false);
  }, [selectedTemplate?.id, selectedTemplate?.updatedAt]);

  useEffect(() => {
    if (!selectedTemplate || workflowTemplates.some((template) => template.id === selectedTemplateId)) {
      return;
    }
    setSelectedTemplateId(selectedTemplate.id);
  }, [selectedTemplate, selectedTemplateId, workflowTemplates]);

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
  }, [selectedMeeting?.id, suggestedTemplate, workflowRuns]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedRunId("");
      return;
    }
    const nextRun = getFallbackRun(workflowRuns, selectedTemplate.id, selectedMeeting?.id);
    setSelectedRunId((currentId) =>
      currentId && availableRuns.some((run) => run.id === currentId) ? currentId : nextRun?.id ?? ""
    );
  }, [availableRuns, selectedMeeting?.id, selectedTemplate, workflowRuns]);

  useEffect(() => {
    if (!selectedTemplate) {
      setSelectedFlowNodeId("");
      return;
    }
    setSelectedFlowNodeId((currentId) =>
      currentId && canvasNodes.some((node) => node.id === currentId) ? currentId : canvasNodes[1]?.id ?? canvasNodes[0]?.id ?? ""
    );
  }, [canvasNodes, selectedTemplate]);

  const workflowNodes = useMemo<Array<Node<WorkflowNodeData>>>(
    () => canvasNodes.map((node) => {
      const nodeRun = selectedRun?.nodeRuns.find((run) => run.nodeId === node.id);
      return {
        id: node.id,
        type: "workflow",
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
        className: `workflow-edge workflow-edge--${state}${edge.id === selectedEdgeId ? " is-selected" : ""}`,
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
  }

  function handleEdgeClick(_event: ReactMouseEvent, edge: Edge) {
    setSelectedEdgeId(edge.id);
    setSelectedFlowNodeId("");
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
    setSelectedFlowNodeId((currentId) => (currentId && nextNodeIds.has(currentId) ? currentId : nextFlowNodes[0]?.id ?? ""));
    setIsCanvasDirty(true);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    const removedEdgeIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removedEdgeIds.size === 0) return;
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => !removedEdgeIds.has(edge.id)));
    setIsCanvasDirty(true);
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
    setIsCanvasDirty(true);
  }

  function handleAddNode() {
    const node = createCanvasNode(canvasNodes.length + 1, {
      x: 120 + canvasNodes.length * 80,
      y: 120 + (canvasNodes.length % 3) * 80
    });
    setCanvasNodes((currentNodes) => [...currentNodes, node]);
    setSelectedFlowNodeId(node.id);
    setSelectedEdgeId("");
    setIsCanvasDirty(true);
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
    setIsCanvasDirty(true);
  }

  function handleDeleteSelectedNode() {
    if (!selectedNode || canvasNodes.length <= 1) return;
    setCanvasNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedFlowNodeId(canvasNodes.find((node) => node.id !== selectedNode.id)?.id ?? "");
    setSelectedEdgeId("");
    setIsCanvasDirty(true);
  }

  function handleDeleteSelectedEdge() {
    if (!selectedEdge) return;
    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdge.id));
    setSelectedEdgeId("");
    setIsCanvasDirty(true);
  }

  function updateCanvasNode(nodeId: string, update: (node: ProductWorkflowNode) => ProductWorkflowNode) {
    setCanvasNodes((currentNodes) => currentNodes.map((node) => (node.id === nodeId ? update(node) : node)));
    setIsCanvasDirty(true);
  }

  function updateCanvasEdge(edgeId: string, update: (edge: ProductWorkflowEdge) => ProductWorkflowEdge) {
    setCanvasEdges((currentEdges) => currentEdges.map((edge) => (edge.id === edgeId ? update(edge) : edge)));
    setIsCanvasDirty(true);
  }

  async function handleSaveCanvas() {
    if (!selectedTemplate) return;
    const template = await onSaveTemplateCanvas(selectedTemplate.id, canvasNodes, canvasEdges);
    if (template) {
      setCanvasNodes(template.nodes.map((node) => ({ ...node })));
      setCanvasEdges(template.edges.map((edge) => ({ ...edge })));
      setIsCanvasDirty(false);
      setSelectedEdgeId("");
    }
  }

  function handleResetCanvas() {
    setCanvasNodes(selectedTemplate?.nodes.map((node) => ({ ...node })) ?? []);
    setCanvasEdges(selectedTemplate?.edges.map((edge) => ({ ...edge })) ?? []);
    setSelectedEdgeId("");
    setIsCanvasDirty(false);
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

  if (isWorkflowLoading && workflowTemplates.length === 0) {
    return (
      <section className="workflow-shell workflow-shell--console ide-workflow workflow-empty-state">
        <div>
          <span>工作流模板</span>
          <strong>正在从 API 加载模板和运行记录...</strong>
        </div>
      </section>
    );
  }

  if (!selectedTemplate || (!selectedNode && !selectedEdge)) {
    return (
      <section className="workflow-shell workflow-shell--console ide-workflow workflow-empty-state">
        <div>
          <span>工作流模板</span>
          <strong>{workflowError || "暂无可用模板"}</strong>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={`workflow-shell workflow-shell--console ide-workflow${
          isCanvasEditMode ? " is-editing" : isWorkflowDetailOpen ? " is-detail" : " is-simple"
        }`}
      >
        <WorkflowCanvasPane
          actionCount={actionCount}
          availableRuns={availableRuns}
          blockedNodeRun={blockedNodeRun}
          canvasNodes={canvasNodes}
          canvasWrapperRef={reactFlowWrapper}
          isCanvasDirty={isCanvasDirty}
          isCanvasEditMode={isCanvasEditMode}
          isCanvasZoomFocused={isCanvasZoomFocused}
          isValidConnection={isValidConnection}
          isWorkflowActionBusy={isWorkflowActionBusy}
          isWorkflowDetailOpen={isWorkflowDetailOpen}
          onAddNode={handleAddNode}
          onAdvanceWorkflowRun={() => void handleAdvanceWorkflowRun()}
          onConnect={handleConnect}
          onDeleteSelectedNode={handleDeleteSelectedNode}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onEdgeClick={handleEdgeClick}
          onEdgesChange={handleEdgesChange}
          onFlowInit={(instance) => { reactFlowInstance.current = instance; }}
          onNodeClick={handleNodeClick}
          onNodesChange={handleNodesChange}
          onResetCanvas={handleResetCanvas}
          onRetryWorkflowRun={() => void handleRetryWorkflowRun()}
          onSaveCanvas={() => void handleSaveCanvas()}
          onSelectRun={selectRun}
          onSelectTemplate={selectTemplate}
          onSetCanvasEditMode={setIsCanvasEditMode}
          onSetCanvasZoomFocused={setIsCanvasZoomFocused}
          onSetWorkflowDetailOpen={setIsWorkflowDetailOpen}
          onStartWorkflowRun={() => void handleStartWorkflowRun()}
          selectedFlowNodeId={selectedFlowNodeId}
          selectedInputPayload={selectedInputPayload}
          selectedMeeting={selectedMeeting}
          selectedNode={selectedNode}
          selectedNodeConfigSnapshot={selectedNodeConfigSnapshot}
          selectedNodeRun={selectedNodeRun}
          selectedOutputPayload={selectedOutputPayload}
          selectedRun={selectedRun}
          selectedTemplate={selectedTemplate}
          selectedTemplateId={selectedTemplateId}
          setSelectedFlowNodeId={setSelectedFlowNodeId}
          workflowEdges={workflowEdges}
          workflowNodes={workflowNodes}
          workflowTemplates={workflowTemplates}
        />

        {isCanvasEditMode && (
          <WorkflowCanvasInspector
            canvasNodes={canvasNodes}
            isCanvasDirty={isCanvasDirty}
            isWorkflowActionBusy={isWorkflowActionBusy}
            onDeleteSelectedEdge={handleDeleteSelectedEdge}
            onResetCanvas={handleResetCanvas}
            onSaveCanvas={() => void handleSaveCanvas()}
            selectedEdge={selectedEdge}
            selectedNode={selectedNode}
            updateCanvasEdge={updateCanvasEdge}
            updateCanvasNode={updateCanvasNode}
          />
        )}

        <WorkflowSupportPanel
          agentError={agentError}
          agentRun={agentRun}
          blockedNodeRun={blockedNodeRun}
          calendarStatusMessage={calendarStatusMessage}
          canSyncFeishuCalendar={canSyncFeishuCalendar}
          canSyncGoogleCalendar={canSyncGoogleCalendar}
          feishuCalendarStatusMessage={feishuCalendarStatusMessage}
          feishuRedirectUri={feishuRedirectUri}
          googleRedirectUri={googleRedirectUri}
          isAgentRunning={isAgentRunning}
          isCalendarLoading={isCalendarLoading}
          isFeishuCalendarConfigured={isFeishuCalendarConfigured}
          isFeishuCalendarConnected={isFeishuCalendarConnected}
          isFeishuCalendarLoading={isFeishuCalendarLoading}
          isGoogleCalendarConfigured={isGoogleCalendarConfigured}
          isGoogleCalendarConnected={isGoogleCalendarConnected}
          isMemoryLoading={isMemoryLoading}
          isMemoryMutating={isMemoryMutating}
          isWorkflowActionBusy={isWorkflowActionBusy}
          isWorkflowDetailOpen={isWorkflowDetailOpen}
          meetingMemories={meetingMemories}
          memoryError={memoryError}
          nextMeetingStatus={nextMeetingStatus}
          onAdvanceWorkflowRun={() => void handleAdvanceWorkflowRun()}
          onCancelWorkflowRun={() => void handleCancelWorkflowRun()}
          onConnectFeishuCalendar={() => void onConnectFeishuCalendar()}
          onConnectGoogleCalendar={() => void onConnectGoogleCalendar()}
          onDeleteMemory={onDeleteMemory}
          onEditMeeting={onEditMeeting}
          onOpenDetail={onOpenDetail}
          onOpenRunDetail={() => setIsRunDetailOpen(true)}
          onRetryWorkflowRun={() => void handleRetryWorkflowRun()}
          onRunAgent={() => void onRunAgent()}
          onStartWorkflowRun={() => void handleStartWorkflowRun()}
          onSyncFeishuCalendar={() => void onSyncFeishuCalendar()}
          onSyncGoogleCalendar={() => void onSyncGoogleCalendar()}
          onUpdateMemory={onUpdateMemory}
          onUpdateStatus={onUpdateStatus}
          resolutionNote={resolutionNote}
          selectedFlowNodeId={selectedFlowNodeId}
          selectedInputPayload={selectedInputPayload}
          selectedMeeting={selectedMeeting}
          selectedNode={selectedNode}
          selectedNodeRun={selectedNodeRun}
          selectedOutputPayload={selectedOutputPayload}
          selectedRun={selectedRun}
          selectedTemplate={selectedTemplate}
          setResolutionNote={setResolutionNote}
          setSelectedFlowNodeId={setSelectedFlowNodeId}
          workflowFeedback={workflowFeedback}
        />
      </section>

      {isRunDetailOpen && selectedRun && (
        <RunDetailDialog
          meeting={selectedMeeting}
          onClose={() => setIsRunDetailOpen(false)}
          run={selectedRun}
          template={selectedTemplate}
        />
      )}
    </>
  );
}

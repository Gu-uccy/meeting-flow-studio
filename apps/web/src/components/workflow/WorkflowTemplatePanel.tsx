import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

import ReactFlow, {

  Background,

  ConnectionLineType,

  ConnectionMode,

  Controls,

  MarkerType,

  MiniMap,

  Panel,

  applyNodeChanges,

  type Connection,

  type Edge,

  type EdgeChange,

  type Node,

  type NodeChange

} from "reactflow";

import {

  actionItemStatusLabels,

  meetingNodeKinds,

  meetingNodeKindLabels,

  meetingStatusLabels,

  participantRoleLabels,

  type MeetingRecord,

  type ProductWorkflowEdge,

  type ProductNodeRunStatus,

  type ProductWorkflowNode,

  type ProductWorkflowRun,

  type ProductWorkflowRunStatus,

  type ProductWorkflowTemplate

} from "@meeting-flow/shared";

import { durationLabel, formatDateRange } from "../../lib/format";

import { Modal } from "../common/Modal";

import { FlowNode } from "./FlowNode";



type WorkflowNodeData = {

  title: string;

  summary: string;

  kind: ProductWorkflowNode["kind"];

  state: "done" | "running" | "waiting" | "blocked" | "optional";

  owner: string;

};



type WorkflowTemplatePanelProps = {

  selectedMeeting: MeetingRecord | null;

  isMutating: boolean;

  isWorkflowLoading: boolean;

  workflowError: string;

  workflowFeedback: string;

  isWorkflowMutating: boolean;

  workflowRuns: ProductWorkflowRun[];

  workflowTemplates: ProductWorkflowTemplate[];

  isGoogleCalendarConfigured: boolean;

  isCalendarLoading: boolean;

  isCalendarMutating: boolean;

  googleRedirectUri: string;

  calendarStatusMessage: string;

  isGoogleCalendarConnected: boolean;

  isFeishuCalendarConfigured: boolean;

  isFeishuCalendarConnected: boolean;

  isFeishuCalendarLoading: boolean;

  isFeishuCalendarMutating: boolean;

  feishuRedirectUri: string;

  feishuCalendarStatusMessage: string;

  onConnectGoogleCalendar: () => Promise<boolean>;

  onConnectFeishuCalendar: () => Promise<boolean>;

  onOpenDetail: () => void;

  onEditMeeting: () => void;

  onSyncGoogleCalendar: () => Promise<MeetingRecord | null>;

  onSyncFeishuCalendar: () => Promise<MeetingRecord | null>;

  onStartWorkflowRun: (templateId: string) => Promise<ProductWorkflowRun | null>;

  onAdvanceWorkflowRun: (runId: string, resolutionNote: string) => Promise<ProductWorkflowRun | null>;

  onCancelWorkflowRun: (runId: string) => Promise<ProductWorkflowRun | null>;

  onRetryWorkflowRun: (runId: string) => Promise<ProductWorkflowRun | null>;

  onSaveTemplateCanvas: (

    templateId: string,

    nodes: ProductWorkflowNode[],

    edges: ProductWorkflowEdge[]

  ) => Promise<ProductWorkflowTemplate | null>;

  onUpdateStatus: (status: MeetingRecord["status"]) => Promise<boolean>;

};



const nodeTypes = {

  workflow: FlowNode

};



const toneByKind: Record<string, string> = {

  trigger: "#8fc0c5",

  ai: "#8fc0c5",

  knowledge: "#7c3aed",

  decision: "#d97706",

  action: "#dc2626"

};



const runStatusLabels: Record<ProductWorkflowRunStatus, string> = {

  queued: "排队中",

  running: "运行中",

  blocked: "已阻塞",

  completed: "已完成",

  failed: "失败"

};



const nodeRunStateMap: Record<ProductNodeRunStatus, WorkflowNodeData["state"]> = {

  pending: "waiting",

  running: "running",

  success: "done",

  blocked: "blocked",

  failed: "blocked",

  skipped: "optional"

};



const nodeRunLabels: Record<ProductNodeRunStatus, string> = {

  pending: "等待",

  running: "运行中",

  success: "成功",

  blocked: "阻塞",

  failed: "失败",

  skipped: "跳过"

};



function getFallbackRun(runs: ProductWorkflowRun[], templateId: string, meetingId?: string | null) {

  return (

    runs.find((run) => run.templateId === templateId && (!meetingId || run.meetingId === meetingId)) ??

    runs.find((run) => run.templateId === templateId) ??

    null

  );

}



function getEdgeState(sourceId: string, targetId: string, run?: ProductWorkflowRun | null): WorkflowNodeData["state"] {

  const sourceRun = run?.nodeRuns.find((item) => item.nodeId === sourceId);

  const targetRun = run?.nodeRuns.find((item) => item.nodeId === targetId);



  if (sourceRun?.status === "blocked" || sourceRun?.status === "failed" || targetRun?.status === "blocked") {

    return "blocked";

  }



  if (sourceRun?.status === "running" || targetRun?.status === "running") {

    return "running";

  }



  if (sourceRun?.status === "success" && targetRun?.status === "success") {

    return "done";

  }



  if (targetRun?.status === "skipped") {

    return "optional";

  }



  return "waiting";

}



function statusClass(status: ProductWorkflowRunStatus | ProductNodeRunStatus) {

  return `status-${status}`;

}



function formatPayload(payload?: Record<string, string | number | boolean>) {

  return Object.entries(payload ?? {}).map(([key, value]) => ({

    key,

    value: String(value)

  }));

}



function getTemplateForMeeting(templates: ProductWorkflowTemplate[], meeting: MeetingRecord | null) {

  if (!meeting) {

    return templates[0] ?? null;

  }



  return templates.find((template) => template.category === meeting.type) ?? templates[0] ?? null;

}



function getNextMeetingStatus(status: MeetingRecord["status"]) {

  if (status === "draft") {

    return {

      label: "提交会议",

      value: "scheduled" as const

    };

  }



  if (status === "scheduled") {

    return {

      label: "开始会议",

      value: "in_progress" as const

    };

  }



  if (status === "in_progress") {

    return {

      label: "标记完成",

      value: "completed" as const

    };

  }



  return null;

}



function getFeaturedNodeId(run: ProductWorkflowRun | null | undefined, template: ProductWorkflowTemplate) {

  const activeRun =

    run?.nodeRuns.find(

      (item) => item.status === "blocked" || item.status === "failed" || item.status === "running"

    ) ?? run?.nodeRuns.find((item) => item.status === "success");



  return activeRun?.nodeId ?? template.nodes[1]?.id ?? template.nodes[0]?.id ?? "";

}



function formatRunTimestamp(value?: string) {

  if (!value) {

    return "未记录";

  }



  return new Date(value).toLocaleString("zh-CN", {

    hour12: false,

    month: "2-digit",

    day: "2-digit",

    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit"

  });

}



function getRunNode(template: ProductWorkflowTemplate, nodeId: string) {

  return template.nodes.find((node) => node.id === nodeId);

}



function createCanvasNode(index: number, position: ProductWorkflowNode["position"]): ProductWorkflowNode {

  return {

    id: `manual-${Date.now()}-${index}`,

    kind: "action",

    title: `新动作节点 ${index}`,

    description: "补充这个节点的职责、输入和输出。",

    position,

    owner: "流程编辑者",

    inputs: ["input"],

    outputs: ["output"],

    configFields: [

      {

        key: "instruction",

        label: "执行说明",

        value: "描述这个节点要完成的动作。",

        kind: "textarea"

      }

    ]

  };

}



function parseList(value: string) {

  return value

    .split(",")

    .map((item) => item.trim())

    .filter(Boolean);

}



function formatList(value: string[]) {

  return value.join(", ");

}



function formatDataMapping(mapping?: Record<string, string>) {

  return Object.entries(mapping ?? {})

    .map(([key, value]) => `${key}=${value}`)

    .join("\n");

}



function parseDataMapping(value: string) {

  return value

    .split("\n")

    .map((line) => line.trim())

    .filter(Boolean)

    .reduce<Record<string, string>>((mapping, line) => {

      const [key, ...rest] = line.split("=");

      const normalizedKey = key.trim();

      const normalizedValue = rest.join("=").trim();



      if (normalizedKey && normalizedValue) {

        mapping[normalizedKey] = normalizedValue;

      }



      return mapping;

    }, {});

}



function getRunConfigSnapshot(run: ProductWorkflowRun, template: ProductWorkflowTemplate, nodeId: string) {

  return (

    run.configSnapshot?.find((snapshot) => snapshot.nodeId === nodeId) ?? {

      nodeId,

      nodeTitle: getRunNode(template, nodeId)?.title ?? nodeId,

      configFields: getRunNode(template, nodeId)?.configFields ?? []

    }

  );

}



function getConfigDriftCount(run: ProductWorkflowRun, template: ProductWorkflowTemplate) {

  return (

    run.configSnapshot?.reduce((count, snapshot) => {

      const currentNode = getRunNode(template, snapshot.nodeId);

      const changedFields = snapshot.configFields.filter((field) => {

        const currentField = currentNode?.configFields.find((item) => item.key === field.key);

        return currentField ? currentField.value !== field.value : false;

      });



      return count + changedFields.length;

    }, 0) ?? 0

  );

}



type RunDetailDialogProps = {

  meeting: MeetingRecord | null;

  onClose: () => void;

  run: ProductWorkflowRun;

  template: ProductWorkflowTemplate;

};



function RunDetailDialog({ meeting, onClose, run, template }: RunDetailDialogProps) {

  const configDriftCount = getConfigDriftCount(run, template);

  const manualRecords = run.nodeRuns

    .map((nodeRun) => ({

      nodeRun,

      note:

        typeof nodeRun.outputPayload?.resolutionNote === "string"

          ? nodeRun.outputPayload.resolutionNote

          : undefined

    }))

    .filter((record) => record.note);



  return (

    <Modal onClose={onClose} size="xl" title="运行详情">

      <div className="run-detail">

        <section className="run-detail__summary" aria-label="运行概览">

          <article>

            <span>运行名称</span>

            <strong>{run.name}</strong>

          </article>

          <article>

            <span>模板</span>

            <strong>{template.name}</strong>

          </article>

          <article>

            <span>会议</span>

            <strong>{meeting?.title ?? run.meetingId}</strong>

          </article>

          <article>

            <span>状态</span>

            <strong>{runStatusLabels[run.status]}</strong>

          </article>

          <article>

            <span>开始</span>

            <strong>{formatRunTimestamp(run.startedAt)}</strong>

          </article>

          <article>

            <span>结束</span>

            <strong>{formatRunTimestamp(run.endedAt)}</strong>

          </article>

          <article>

            <span>耗时</span>

            <strong>{run.durationSeconds}s</strong>

          </article>

          <article>

            <span>节点</span>

            <strong>{run.nodeRuns.length}</strong>

          </article>

          <article>

            <span>配置变更</span>

            <strong>{run.configSnapshot ? `${configDriftCount} 项` : "无快照"}</strong>

          </article>

        </section>



        <div className="run-detail__grid">

          <section className="run-detail__section">

            <div className="run-detail__section-title">

              <strong>节点执行时间线</strong>

            </div>

            <div className="run-timeline">

              {run.nodeRuns.map((nodeRun) => {

                const node = getRunNode(template, nodeRun.nodeId);



                return (

                  <article className={`run-timeline__item run-timeline__item--${nodeRun.status}`} key={nodeRun.nodeId}>

                    <span>{nodeRunLabels[nodeRun.status]}</span>

                    <strong>{node?.title ?? nodeRun.nodeId}</strong>

                    <p>

                      {formatRunTimestamp(nodeRun.startedAt)} 至 {formatRunTimestamp(nodeRun.endedAt)}

                    </p>

                    {nodeRun.errorMessage && <em>{nodeRun.errorMessage}</em>}

                  </article>

                );

              })}

            </div>

          </section>



          <section className="run-detail__section">

            <div className="run-detail__section-title">

              <strong>人工处理记录</strong>

            </div>

            {manualRecords.length > 0 ? (

              <div className="run-manual-list">

                {manualRecords.map(({ nodeRun, note }) => (

                  <article key={nodeRun.nodeId}>

                    <span>{getRunNode(template, nodeRun.nodeId)?.title ?? nodeRun.nodeId}</span>

                    <strong>{note}</strong>

                    <p>{formatRunTimestamp(nodeRun.endedAt)}</p>

                  </article>

                ))}

              </div>

            ) : (

              <p className="run-detail__empty">本次运行没有人工处理记录。</p>

            )}

          </section>



          <section className="run-detail__section run-detail__section--wide">

            <div className="run-detail__section-title">

              <strong>配置快照</strong>

            </div>

            <div className="run-config-snapshot">

              {run.nodeRuns.map((nodeRun) => {

                const explicitSnapshot = run.configSnapshot?.find((item) => item.nodeId === nodeRun.nodeId);

                const currentNode = getRunNode(template, nodeRun.nodeId);

                const snapshot = getRunConfigSnapshot(run, template, nodeRun.nodeId);



                return (

                  <article key={nodeRun.nodeId}>

                    <strong>{snapshot.nodeTitle}</strong>

                    {!explicitSnapshot && <p>这条历史运行没有保存配置快照，下面显示当前模板配置。</p>}

                    <div>

                      {snapshot.configFields.length > 0 ? (

                        snapshot.configFields.map((field) => {

                          const currentField = currentNode?.configFields.find((item) => item.key === field.key);

                          const isChanged = Boolean(explicitSnapshot && currentField && currentField.value !== field.value);



                          return (

                            <code className={isChanged ? "is-changed" : ""} key={field.key}>

                              {field.label}: {field.value}

                              {isChanged && <em>当前: {currentField?.value}</em>}

                            </code>

                          );

                        })

                      ) : (

                        <code>无配置项</code>

                      )}

                    </div>

                  </article>

                );

              })}

            </div>

          </section>



          <section className="run-detail__section run-detail__section--wide">

            <div className="run-detail__section-title">

              <strong>原始日志</strong>

            </div>

            <div className="run-log-table">

              {run.logs.map((log) => (

                <article className={`run-log-table__row run-log-table__row--${log.level}`} key={log.id}>

                  <span>{log.time}</span>

                  <code>{log.nodeId ?? "system"}</code>

                  <p>{log.message}</p>

                </article>

              ))}

            </div>

          </section>

        </div>

      </div>

    </Modal>

  );

}



export function WorkflowTemplatePanel({

  selectedMeeting,

  isMutating,

  isWorkflowLoading,

  workflowError,

  workflowFeedback,

  isWorkflowMutating,

  workflowRuns,

  workflowTemplates,

  isGoogleCalendarConfigured,

  isCalendarLoading,

  isCalendarMutating,

  googleRedirectUri,

  calendarStatusMessage,

  isGoogleCalendarConnected,

  isFeishuCalendarConfigured,

  isFeishuCalendarConnected,

  isFeishuCalendarLoading,

  isFeishuCalendarMutating,

  feishuRedirectUri,

  feishuCalendarStatusMessage,

  onConnectGoogleCalendar,

  onConnectFeishuCalendar,

  onOpenDetail,

  onEditMeeting,

  onSyncGoogleCalendar,

  onSyncFeishuCalendar,

  onStartWorkflowRun,

  onAdvanceWorkflowRun,

  onCancelWorkflowRun,

  onRetryWorkflowRun,

  onSaveTemplateCanvas,

  onUpdateStatus

}: WorkflowTemplatePanelProps) {

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

  const lastAutoMatchedMeetingId = useRef<string | null>(null);

  const suggestedTemplate = getTemplateForMeeting(workflowTemplates, selectedMeeting);

  const canSyncFeishuCalendar = !isFeishuCalendarConfigured || isFeishuCalendarConnected;

  const canSyncGoogleCalendar = !isGoogleCalendarConfigured || isGoogleCalendarConnected;

  const selectedTemplate =

    workflowTemplates.find((template) => template.id === selectedTemplateId) ?? suggestedTemplate;

  const availableRuns = useMemo(

    () => (selectedTemplate ? workflowRuns.filter((run) => run.templateId === selectedTemplate.id) : []),

    [selectedTemplate, workflowRuns]

  );

  const selectedRun =

    availableRuns.find((run) => run.id === selectedRunId) ??

    (selectedTemplate ? getFallbackRun(workflowRuns, selectedTemplate.id, selectedMeeting?.id) : null);

  const selectedEdge = canvasEdges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const selectedNode =

    selectedEdge ? null : canvasNodes.find((node) => node.id === selectedFlowNodeId) ?? canvasNodes[1] ?? canvasNodes[0] ?? null;

  const selectedNodeRun = selectedNode ? selectedRun?.nodeRuns.find((run) => run.nodeId === selectedNode.id) : undefined;

  const selectedNodeConfigSnapshot = selectedNode

    ? selectedRun?.configSnapshot?.find((snapshot) => snapshot.nodeId === selectedNode.id)

    : undefined;

  const actionCount = selectedMeeting?.actionItems.length ?? 0;

  const selectedInputPayload = formatPayload(selectedNodeRun?.inputPayload);

  const selectedOutputPayload = formatPayload(selectedNodeRun?.outputPayload);

  const nextMeetingStatus = selectedMeeting ? getNextMeetingStatus(selectedMeeting.status) : null;

  const blockedNodeRun = selectedRun?.nodeRuns.find((run) => run.status === "blocked" || run.status === "failed");

  const isWorkflowActionBusy = isMutating || isWorkflowMutating || isCalendarMutating || isFeishuCalendarMutating;



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

      currentId && canvasNodes.some((node) => node.id === currentId)

        ? currentId

        : canvasNodes[1]?.id ?? canvasNodes[0]?.id ?? ""

    );

  }, [canvasNodes, selectedTemplate]);



  function selectTemplate(templateId: string) {

    const nextTemplate = workflowTemplates.find((template) => template.id === templateId) ?? workflowTemplates[0];



    if (!nextTemplate) {

      return;

    }



    const nextRun = getFallbackRun(workflowRuns, nextTemplate.id, selectedMeeting?.id);



    setSelectedTemplateId(nextTemplate.id);

    setSelectedRunId(nextRun?.id ?? "");

    setSelectedFlowNodeId(getFeaturedNodeId(nextRun, nextTemplate));

  }



  function selectRun(run: ProductWorkflowRun) {

    if (!selectedTemplate) {

      return;

    }



    setSelectedRunId(run.id);

    setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));

  }



  const workflowNodes = useMemo<Array<Node<WorkflowNodeData>>>(

    () =>

      canvasNodes.map((node) => {

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

    () =>

      canvasEdges.map((edge) => {

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

          labelStyle: {

            fill: "#374151",

            fontSize: 11,

            fontWeight: 600

          },

          labelBgStyle: {

            fill: "#ffffff",

            stroke: "#e5e7eb"

          },

          style: {

            strokeWidth: state === "blocked" ? 2.5 : 2

          }

        };

      }),

    [canvasEdges, selectedEdgeId, selectedRun]

  );



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



    if (!hasCanvasChange) {

      return;

    }



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

    setCanvasEdges((currentEdges) =>

      currentEdges.filter((edge) => nextNodeIds.has(edge.source) && nextNodeIds.has(edge.target))

    );

    setSelectedFlowNodeId((currentId) => (currentId && nextNodeIds.has(currentId) ? currentId : nextFlowNodes[0]?.id ?? ""));

    setIsCanvasDirty(true);

  }



  function handleEdgesChange(changes: EdgeChange[]) {

    const removedEdgeIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));



    if (removedEdgeIds.size === 0) {

      return;

    }



    setCanvasEdges((currentEdges) => currentEdges.filter((edge) => !removedEdgeIds.has(edge.id)));

    setIsCanvasDirty(true);

  }



  function isValidConnection(connection: Connection) {

    // No self-connections

    if (connection.source === connection.target) return false;



    // No duplicate edges

    const exists = canvasEdges.some(

      (edge) => edge.source === connection.source && edge.target === connection.target

    );

    if (exists) return false;



    return true;

  }



  function handleConnect(connection: Connection) {

    if (!connection.source || !connection.target) return;

    if (!isValidConnection(connection)) return;



    const edgeId = `${connection.source}-${connection.target}-${Date.now()}`;



    setCanvasEdges((currentEdges) => [

      ...currentEdges,

      {

        id: edgeId,

        source: connection.source ?? "",

        target: connection.target ?? "",

        label: ""

      }

    ]);

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



  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);



  function handleDragOver(event: React.DragEvent) {

    event.preventDefault();

    event.dataTransfer.dropEffect = "move";

  }



  function handleDrop(event: React.DragEvent) {

    event.preventDefault();



    const kind = event.dataTransfer.getData("application/reactflow-kind") as ProductWorkflowNode["kind"] | "";

    if (!kind || !reactFlowInstance || !reactFlowWrapper.current) return;



    const bounds = reactFlowWrapper.current.getBoundingClientRect();

    const position = reactFlowInstance.project({

      x: event.clientX - bounds.left,

      y: event.clientY - bounds.top

    });



    const kindLabels: Record<string, string> = {

      trigger: "新触发节点",

      ai: "新 AI 节点",

      knowledge: "新知识节点",

      decision: "新决策节点",

      action: "新动作节点"

    };



    const newNode: ProductWorkflowNode = {

      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,

      kind,

      title: kindLabels[kind] ?? "新节点",

      description: "双击或点击后在右侧面板编辑此节点。",

      position,

      owner: "",

      inputs: ["input"],

      outputs: ["output"],

      configFields: kind === "ai"

        ? [

            { key: "model", label: "模型", value: "会议议程助手", kind: "select" },

            { key: "prompt", label: "提示词", value: "请根据会议信息生成内容。", kind: "textarea" },

            { key: "temperature", label: "创造性", value: "中", kind: "select" }

          ]

        : kind === "decision"

          ? [

              { key: "condition", label: "判断条件", value: "", kind: "textarea" },

              { key: "timeout", label: "超时策略", value: "30 分钟后提醒", kind: "text" }

            ]

          : kind === "knowledge"

            ? [

                { key: "sources", label: "数据源", value: "", kind: "textarea" },

                { key: "maxDocs", label: "最大文档数", value: "8", kind: "text" }

              ]

            : [

                { key: "instruction", label: "执行说明", value: "", kind: "textarea" }

              ]

    };



    setCanvasNodes((currentNodes) => [...currentNodes, newNode]);

    setSelectedFlowNodeId(newNode.id);

    setSelectedEdgeId("");

    setIsCanvasDirty(true);

  }



  function handleDeleteSelectedNode() {

    if (!selectedNode || canvasNodes.length <= 1) {

      return;

    }



    setCanvasNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNode.id));

    setCanvasEdges((currentEdges) =>

      currentEdges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id)

    );

    setSelectedFlowNodeId(canvasNodes.find((node) => node.id !== selectedNode.id)?.id ?? "");

    setSelectedEdgeId("");

    setIsCanvasDirty(true);

  }



  function handleDeleteSelectedEdge() {

    if (!selectedEdge) {

      return;

    }



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

    if (!selectedTemplate) {

      return;

    }



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

    if (!selectedTemplate || !selectedMeeting) {

      return;

    }



    const run = await onStartWorkflowRun(selectedTemplate.id);



    if (run) {

      setSelectedRunId(run.id);

      setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));

      setResolutionNote("");

    }

  }



  async function handleAdvanceWorkflowRun() {

    if (!selectedRun || !selectedTemplate) {

      return;

    }



    const run = await onAdvanceWorkflowRun(selectedRun.id, resolutionNote.trim());



    if (run) {

      setSelectedRunId(run.id);

      setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));

      setResolutionNote("");

    }

  }



  async function handleRetryWorkflowRun() {

    if (!selectedRun) return;



    const run = await onRetryWorkflowRun(selectedRun.id);

    if (run) {

      setSelectedRunId(run.id);

      setSelectedFlowNodeId(getFeaturedNodeId(run, selectedTemplate));

    }

  }



  async function handleCancelWorkflowRun() {

    if (!selectedRun) return;



    const run = await onCancelWorkflowRun(selectedRun.id);

    if (run) {

      setSelectedRunId(run.id);

    }

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

    <section className="workflow-shell workflow-shell--console ide-workflow">

      <div className="ide-canvas-pane">

        <div className="ide-pane-header ide-pane-header--workflow">

          <div className="workflow-title-block">

            <strong>流程画布</strong>

            {isCanvasDirty && <p>画布有未保存修改</p>}

          </div>

          <div className="workflow-header-actions">

            <div className="canvas-editor-actions" aria-label="画布编辑">

              <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={handleAddNode} type="button">

                添加节点

              </button>

              <button

                className="ghost-button"

                disabled={isWorkflowActionBusy || !selectedNode || canvasNodes.length <= 1}

                onClick={handleDeleteSelectedNode}

                type="button"

              >

                删除节点

              </button>

              <button

                className="ghost-button"

                disabled={isWorkflowActionBusy || !isCanvasDirty}

                onClick={handleResetCanvas}

                type="button"

              >

                撤销修改

              </button>

              <button

                className="primary-button"

                disabled={isWorkflowActionBusy || !isCanvasDirty}

                onClick={() => void handleSaveCanvas()}

                type="button"

              >

                保存画布

              </button>

            </div>

          </div>

          <div className="workflow-template-row">

            <div className="template-switcher ide-tabs" aria-label="模板选择">

              {workflowTemplates.map((template) => (

                <button

                  className={template.id === selectedTemplate.id ? "is-active" : ""}

                  key={template.id}

                  onClick={() => selectTemplate(template.id)}

                  type="button"

                >

                  {template.name}

                </button>

              ))}

            </div>

          </div>

        </div>



        <div className="workflow-canvas-summary" aria-label="流程运行与当前会议">
        {selectedNode && (
          <>
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
                  {selectedInputPayload.length > 0 ? (
                    selectedInputPayload.map((item) => (
                      <code key={item.key}>
                        {item.key}: {item.value}
                      </code>
                    ))
                  ) : (
                    <code>暂无输入</code>
                  )}
                </div>
              </section>
              <section>
                <span>输出</span>
                <div>
                  {selectedOutputPayload.length > 0 ? (
                    selectedOutputPayload.map((item) => (
                      <code key={item.key}>
                        {item.key}: {item.value}
                      </code>
                    ))
                  ) : (
                    <code>暂无输出</code>
                  )}
                </div>
              </section>
              <section>
                <span>运行配置快照</span>
                <div>
                  {selectedNodeConfigSnapshot?.configFields.length ? (
                    selectedNodeConfigSnapshot.configFields.map((field) => (
                      <code key={field.key}>
                        {field.label}: {field.value}
                      </code>
                    ))
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

            <div className="ide-runtime-grid" aria-label="流程运行状态">
              <div>
                <span>运行状态</span>
                <strong>{selectedRun ? runStatusLabels[selectedRun.status] : "暂无运行"}</strong>
              </div>
              <div>
                <span>当前节点</span>
                <strong>{selectedNodeRun ? nodeRunLabels[selectedNodeRun.status] : "未运行"}</strong>
              </div>
              <div>
                <span>行动项</span>
                <strong>{actionCount} 项</strong>
              </div>
            </div>
          </>
        )}

        <section className="ide-current-meeting" aria-label="当前会议">
          <span>当前会议</span>
          {selectedMeeting ? (
            <>
              <strong>{selectedMeeting.title}</strong>
              <p>
                {meetingStatusLabels[selectedMeeting.status]} / {durationLabel(selectedMeeting.durationMinutes)}
              </p>
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
          onBlur={() => setIsCanvasZoomFocused(false)}
          onClick={() => setIsCanvasZoomFocused(true)}
          onMouseLeave={() => setIsCanvasZoomFocused(false)}
          onFocus={() => setIsCanvasZoomFocused(true)}
          ref={reactFlowWrapper}
          tabIndex={0}
        >

          <ReactFlow

            fitView

            edges={workflowEdges}

            nodes={workflowNodes}

            nodeTypes={nodeTypes}

            nodesDraggable

            nodesConnectable

            zoomOnScroll={isCanvasZoomFocused}

            preventScrolling={isCanvasZoomFocused}

            edgesFocusable

            deleteKeyCode={["Backspace", "Delete"]}

            elementsSelectable

            isValidConnection={isValidConnection}

            onConnect={handleConnect}

            onDragOver={handleDragOver}

            onDrop={handleDrop}

            onEdgesChange={handleEdgesChange}

            onEdgeClick={handleEdgeClick}

            onInit={setReactFlowInstance}

            onNodesChange={handleNodesChange}

            onNodeClick={handleNodeClick}

            connectionMode={ConnectionMode.Loose}

            connectionLineStyle={{

              stroke: "#8fc0c5",

              strokeWidth: 2,

              strokeDasharray: "5 5"

            }}

            connectionLineType={ConnectionLineType.SmoothStep}

            defaultEdgeOptions={{

              type: "smoothstep",

              animated: false,

              style: { strokeWidth: 2 },

              markerEnd: {

                type: MarkerType.ArrowClosed,

                width: 16,

                height: 16,

                color: "#94a3b8"

              }

            }}

            snapToGrid={true}

            snapGrid={[16, 16]}

            fitViewOptions={{ padding: 0.3 }}

          >

            <Panel position="top-left">

              <div className="canvas-pill ide-pill">

                {selectedRun

                  ? `${runStatusLabels[selectedRun.status]} / ${selectedRun.durationSeconds}s / ${selectedTemplate.status}`

                  : `暂无运行记录 / ${selectedTemplate.status}`}

              </div>

            </Panel>

            <Panel position="top-right">

              <div className="node-palette" aria-label="节点面板">

                <span>拖入画布</span>

                {meetingNodeKinds.map((kind) => (

                  <div

                    className="node-palette__item"

                    key={kind}

                    draggable

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

            </Panel>

            <Controls showInteractive={false} />

            <MiniMap

              nodeStrokeColor="#94a3b8"

              nodeColor={(node) => toneByKind[(node.data as WorkflowNodeData).kind] ?? "#64748b"}

              maskColor="rgba(0,0,0,0.08)"

              style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}

            />

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

                  onClick={() => selectRun(run)}

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

          <div className="ide-run-log runs-panel__logs">

            {selectedRun ? (

              selectedRun.logs.map((log) => (

                <button

                  className={`ide-run-log__row ide-run-log__row--${log.level}${

                    log.nodeId === selectedFlowNodeId ? " is-active" : ""

                  }`}

                  disabled={!log.nodeId}

                  key={log.id}

                  onClick={() => {

                    if (log.nodeId) {

                      setSelectedFlowNodeId(log.nodeId);

                    }

                  }}

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

        </div>

      </div>



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

                    onChange={(event) =>

                      updateCanvasEdge(selectedEdge.id, (edge) => ({

                        ...edge,

                        label: event.target.value

                      }))

                    }

                  />

                </label>

                <label>

                  运行条件

                  <textarea

                    value={selectedEdge.condition ?? ""}

                    onChange={(event) =>

                      updateCanvasEdge(selectedEdge.id, (edge) => ({

                        ...edge,

                        condition: event.target.value.trim() ? event.target.value : undefined

                      }))

                    }

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

                <button className="danger-button" disabled={isWorkflowActionBusy} onClick={handleDeleteSelectedEdge} type="button">

                  删除连线

                </button>

                <button className="primary-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={() => void handleSaveCanvas()} type="button">

                  保存画布

                </button>

              </div>

            </>
          ) : selectedNode ? (
            <>

              <div className="ide-form">

                <label>

                  节点标题

                  <input

                    value={selectedNode.title}

                    onChange={(event) =>

                      updateCanvasNode(selectedNode.id, (node) => ({

                        ...node,

                        title: event.target.value

                      }))

                    }

                  />

                </label>

                <label>

                  节点描述

                  <textarea

                    value={selectedNode.description}

                    onChange={(event) =>

                      updateCanvasNode(selectedNode.id, (node) => ({

                        ...node,

                        description: event.target.value

                      }))

                    }

                  />

                </label>

                <label>

                  节点类型

                  <select

                    value={selectedNode.kind}

                    onChange={(event) =>

                      updateCanvasNode(selectedNode.id, (node) => ({

                        ...node,

                        kind: event.target.value as ProductWorkflowNode["kind"]

                      }))

                    }

                  >

                    {meetingNodeKinds.map((kind) => (

                      <option key={kind} value={kind}>

                        {meetingNodeKindLabels[kind]}

                      </option>

                    ))}

                  </select>

                </label>

                <label>

                  负责人

                  <input

                    value={selectedNode.owner}

                    onChange={(event) =>

                      updateCanvasNode(selectedNode.id, (node) => ({

                        ...node,

                        owner: event.target.value

                      }))

                    }

                  />

                </label>

                <label>

                  输入

                  <input

                    value={formatList(selectedNode.inputs)}

                    onChange={(event) =>

                      updateCanvasNode(selectedNode.id, (node) => ({

                        ...node,

                        inputs: parseList(event.target.value)

                      }))

                    }

                  />

                </label>

                <label>

                  输出

                  <input

                    value={formatList(selectedNode.outputs)}

                    onChange={(event) =>

                      updateCanvasNode(selectedNode.id, (node) => ({

                        ...node,

                        outputs: parseList(event.target.value)

                      }))

                    }

                  />

                </label>

                {selectedNode.configFields.map((field) => (

                  <label key={field.key}>

                    {field.label}

                    {field.kind === "textarea" ? (

                      <textarea

                        value={field.value}

                        onChange={(event) =>

                          updateCanvasNode(selectedNode.id, (node) => ({

                            ...node,

                            configFields: node.configFields.map((item) =>

                              item.key === field.key ? { ...item, value: event.target.value } : item

                            )

                          }))

                        }

                      />

                    ) : (

                      <input

                        value={field.value}

                        onChange={(event) =>

                          updateCanvasNode(selectedNode.id, (node) => ({

                            ...node,

                            configFields: node.configFields.map((item) =>

                              item.key === field.key ? { ...item, value: event.target.value } : item

                            )

                          }))

                        }

                      />

                    )}

                  </label>

                ))}

                <div className="ide-config-actions">

                  <button className="ghost-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={handleResetCanvas} type="button">

                    放弃修改

                  </button>

                  <button className="primary-button" disabled={!isCanvasDirty || isWorkflowActionBusy} onClick={() => void handleSaveCanvas()} type="button">

                    保存画布

                  </button>

                </div>

              </div>



            </>
          ) : null}
        </div>
      </aside>

      <div className="workflow-support-panel" aria-label="流程辅助信息">

        {selectedMeeting && (
          <div className="ide-related" aria-label="会议议程预览">
            <section>
              <div className="ide-section-title">
                <strong>会议议程预览</strong>
                <span>{selectedMeeting.agendaItems.length} 项</span>
              </div>
              {selectedMeeting.agendaItems.map((item) => (
                <article className="ide-list-row" key={item.id}>
                  <i className={item.completed ? "is-done" : ""} />
                  <span>{item.title}</span>
                  <small>{item.completed ? "已完成" : "待讨论"}</small>
                </article>
              ))}
            </section>

            <section>
              <div className="ide-section-title">
                <strong>参会人与待办</strong>
                <span>{selectedMeeting.participants.length} 人</span>
              </div>
              {selectedMeeting.participants.slice(0, 3).map((participant) => (
                <article className="ide-list-row" key={participant.id}>
                  <b>{participant.name.slice(0, 1)}</b>
                  <span>{participant.name}</span>
                  <small>{participantRoleLabels[participant.role]}</small>
                </article>
              ))}
              {selectedMeeting.actionItems.slice(0, 3).map((item) => (
                <article className="ide-list-row ide-list-row--action" key={item.id}>
                  <span>
                    {item.content} / {item.owner} / {actionItemStatusLabels[item.status]}
                  </span>
                </article>
              ))}
            </section>
          </div>
        )}

        {selectedMeeting && (
          <section className="calendar-integration-card" aria-label="会议日历接入">
            <div>
              <span>会议日历接入</span>
              <strong>Google Calendar / 飞书日历</strong>
              <p>
                {calendarStatusMessage || feishuCalendarStatusMessage || "同步会议时间、参会人和议程到外部日历。"}
              </p>
              {googleRedirectUri && <code>Google Redirect URI: {googleRedirectUri}</code>}
              {feishuRedirectUri && <code>Feishu Redirect URI: {feishuRedirectUri}</code>}
            </div>
            <div className="calendar-integration-card__actions">
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy || isCalendarLoading || !canSyncGoogleCalendar}
                onClick={() => void onSyncGoogleCalendar()}
                type="button"
              >
                同步 Google
              </button>
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !canSyncFeishuCalendar}
                onClick={() => void onSyncFeishuCalendar()}
                type="button"
              >
                同步飞书
              </button>
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy || isCalendarLoading || !isGoogleCalendarConfigured || isGoogleCalendarConnected}
                onClick={() => void onConnectGoogleCalendar()}
                type="button"
              >
                连接 Google
              </button>
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy || isFeishuCalendarLoading || !isFeishuCalendarConfigured || isFeishuCalendarConnected}
                onClick={() => void onConnectFeishuCalendar()}
                type="button"
              >
                连接飞书
              </button>
            </div>
          </section>
        )}

        <div className="inspector-actions ide-actions" aria-label="流程操作">
          <div className="ide-actions__row">
            <button className="ghost-button" disabled={!selectedMeeting || isWorkflowActionBusy} onClick={onEditMeeting} type="button">
              编辑会议
            </button>
            {nextMeetingStatus && (
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy}
                onClick={() => void onUpdateStatus(nextMeetingStatus.value)}
                type="button"
              >
                {nextMeetingStatus.label}
              </button>
            )}
            <button className="ghost-button" disabled={!selectedNode || isWorkflowActionBusy} onClick={() => setSelectedFlowNodeId(selectedNode?.id ?? "")} type="button">
              定位当前节点
            </button>
            {selectedRun && (
              <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void handleRetryWorkflowRun()} type="button">
                重新运行
              </button>
            )}
            {selectedRun && selectedRun.status === "running" && (
              <button className="danger-button" disabled={isWorkflowActionBusy} onClick={() => void handleCancelWorkflowRun()} type="button">
                取消运行
              </button>
            )}
            <button className="ghost-button" disabled={!selectedMeeting} onClick={onOpenDetail} type="button">
              查看会议详情
            </button>
            <button className="ghost-button" disabled={!selectedRun} onClick={() => setIsRunDetailOpen(true)} type="button">
              查看运行详情
            </button>
          </div>
          {blockedNodeRun && (
            <textarea
              aria-label="阻塞处理说明"
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="记录阻塞处理说明"
              value={resolutionNote}
            />
          )}
          <button
            className="primary-button ide-actions__full"
            disabled={!selectedMeeting || !selectedTemplate || isWorkflowActionBusy}
            onClick={() => void (blockedNodeRun ? handleAdvanceWorkflowRun() : handleStartWorkflowRun())}
            type="button"
          >
            {blockedNodeRun ? "处理阻塞并继续" : "启动流程"}
          </button>
          {workflowFeedback && <p>{workflowFeedback}</p>}
        </div>
      </div>
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


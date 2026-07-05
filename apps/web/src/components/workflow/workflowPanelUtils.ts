import type {
  MeetingRecord,
  ProductNodeRunStatus,
  ProductWorkflowNode,
  ProductWorkflowRun,
  ProductWorkflowRunStatus,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";
import type { WorkflowNodeData } from "./workflowPanelTypes";

export const toneByKind: Record<string, string> = {
  trigger: "#8fc0c5",
  ai: "#8fc0c5",
  knowledge: "#7c3aed",
  decision: "#d97706",
  action: "#dc2626"
};

export const runStatusLabels: Record<ProductWorkflowRunStatus, string> = {
  queued: "排队中",
  running: "运行中",
  blocked: "已阻塞",
  completed: "已完成",
  failed: "失败"
};

export const nodeRunStateMap: Record<ProductNodeRunStatus, WorkflowNodeData["state"]> = {
  pending: "waiting",
  running: "running",
  success: "done",
  blocked: "blocked",
  failed: "blocked",
  skipped: "optional"
};

export const nodeRunLabels: Record<ProductNodeRunStatus, string> = {
  pending: "等待",
  running: "运行中",
  success: "成功",
  blocked: "阻塞",
  failed: "失败",
  skipped: "跳过"
};

export const agentActionPriorityLabels = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急"
} as const;

export const agentInsightKindLabels = {
  risk: "风险",
  opportunity: "机会",
  context: "上下文",
  automation: "自动化"
} as const;

export function getFallbackRun(runs: ProductWorkflowRun[], templateId: string, meetingId?: string | null) {
  return (
    runs.find((run) => run.templateId === templateId && (!meetingId || run.meetingId === meetingId))
    ?? runs.find((run) => run.templateId === templateId)
    ?? null
  );
}

export function getEdgeState(sourceId: string, targetId: string, run?: ProductWorkflowRun | null): WorkflowNodeData["state"] {
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

export function statusClass(status: ProductWorkflowRunStatus | ProductNodeRunStatus) {
  return `status-${status}`;
}

export function formatPayload(payload?: Record<string, unknown>) {
  return Object.entries(payload ?? {}).map(([key, value]) => ({
    key,
    value: String(value)
  }));
}

export function getTemplateForMeeting(templates: ProductWorkflowTemplate[], meeting: MeetingRecord | null) {
  if (!meeting) {
    return templates[0] ?? null;
  }

  return templates.find((template) => template.category === meeting.type) ?? templates[0] ?? null;
}

export function getNextMeetingStatus(status: MeetingRecord["status"]) {
  if (status === "draft") {
    return { label: "提交会议", value: "scheduled" as const };
  }

  if (status === "scheduled") {
    return { label: "开始会议", value: "in_progress" as const };
  }

  if (status === "in_progress") {
    return { label: "标记完成", value: "completed" as const };
  }

  return null;
}

export function getFeaturedNodeId(run: ProductWorkflowRun | null | undefined, template: ProductWorkflowTemplate) {
  if (!run) {
    return template.nodes[1]?.id ?? template.nodes[0]?.id ?? "";
  }

  const blockedNode = run.nodeRuns.find((nodeRun) => nodeRun.status === "blocked" || nodeRun.status === "failed");
  if (blockedNode) {
    return blockedNode.nodeId;
  }

  const runningNode = run.nodeRuns.find((nodeRun) => nodeRun.status === "running");
  if (runningNode) {
    return runningNode.nodeId;
  }

  const lastSuccess = [...run.nodeRuns].reverse().find((nodeRun) => nodeRun.status === "success");
  return lastSuccess?.nodeId ?? template.nodes[0]?.id ?? "";
}

export function formatRunTimestamp(value?: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

export function getRunNode(template: ProductWorkflowTemplate, nodeId: string) {
  return template.nodes.find((node) => node.id === nodeId);
}

export function createCanvasNode(index: number, position: ProductWorkflowNode["position"]): ProductWorkflowNode {
  return {
    id: `node-${Date.now()}-${index}`,
    kind: "action",
    title: `新节点 ${index}`,
    description: "在右侧配置节点说明、输入输出和配置字段。",
    position,
    owner: "未分配",
    inputs: ["input"],
    outputs: ["output"],
    configFields: [{ key: "instruction", label: "执行说明", value: "", kind: "textarea" }]
  };
}

export function parseList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatList(value: string[]) {
  return value.join(", ");
}

export function formatDataMapping(mapping?: Record<string, string>) {
  if (!mapping || Object.keys(mapping).length === 0) {
    return "";
  }

  return Object.entries(mapping)
    .map(([source, target]) => `${source} -> ${target}`)
    .join("\n");
}

export function parseDataMapping(value: string) {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [source, target] = line.split("->").map((part) => part.trim());
        return source && target ? [source, target] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
}

export function getRunConfigSnapshot(run: ProductWorkflowRun, template: ProductWorkflowTemplate, nodeId: string) {
  const explicitSnapshot = run.configSnapshot?.find((item) => item.nodeId === nodeId);
  const currentNode = getRunNode(template, nodeId);

  return {
    nodeTitle: explicitSnapshot?.nodeTitle ?? currentNode?.title ?? nodeId,
    configFields: explicitSnapshot?.configFields ?? currentNode?.configFields ?? []
  };
}

export function getConfigDriftCount(run: ProductWorkflowRun, template: ProductWorkflowTemplate) {
  if (!run.configSnapshot) {
    return 0;
  }

  return run.configSnapshot.reduce((count, snapshot) => {
    const currentNode = getRunNode(template, snapshot.nodeId);
    if (!currentNode) {
      return count;
    }

    const driftedFields = snapshot.configFields.filter((field) => {
      const currentField = currentNode.configFields.find((item) => item.key === field.key);
      return currentField && currentField.value !== field.value;
    });

    return count + driftedFields.length;
  }, 0);
}

export function buildDroppedNode(kind: ProductWorkflowNode["kind"], position: ProductWorkflowNode["position"]): ProductWorkflowNode {
  const kindLabels: Record<string, string> = {
    trigger: "新触发节点",
    ai: "新 AI 节点",
    knowledge: "新知识节点",
    decision: "新决策节点",
    action: "新动作节点"
  };

  return {
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
          : [{ key: "instruction", label: "执行说明", value: "", kind: "textarea" }]
  };
}

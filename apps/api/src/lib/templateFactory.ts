import {
  DEFAULT_WORKSPACE_ID,
  ensureProductWorkflowNodeExecutors,
  type MeetingType,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";

export function createTemplateId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankWorkflowTemplate(params: {
  name: string;
  description?: string;
  category?: MeetingType;
  workspaceId?: string;
}): ProductWorkflowTemplate {
  const templateId = createTemplateId();
  const now = new Date().toISOString();

  const template: ProductWorkflowTemplate = {
    id: templateId,
    name: params.name.trim() || "未命名工作流",
    description: params.description?.trim() || "新建工作流模板",
    category: params.category ?? "weekly",
    status: "draft",
    workspaceId: params.workspaceId?.trim() || DEFAULT_WORKSPACE_ID,
    updatedAt: now,
    nodes: [
      {
        id: "trigger-1",
        kind: "trigger",
        title: "会议触发",
        description: "接收会议输入并启动流程",
        position: { x: 80, y: 140 },
        owner: "system",
        inputs: [],
        outputs: ["meetingRequest"],
        configFields: []
      },
      {
        id: "ai-1",
        kind: "ai",
        title: "AI 处理",
        description: "根据会议上下文生成结构化输出",
        position: { x: 320, y: 140 },
        owner: "system",
        inputs: ["meetingRequest"],
        outputs: ["result"],
        configFields: [
          { key: "model", label: "模型", value: "claude-sonnet-4", kind: "select" },
          { key: "temperature", label: "创造性", value: "0.5", kind: "select" }
        ]
      }
    ],
    edges: [{ id: "edge-trigger-ai", source: "trigger-1", target: "ai-1", label: "start" }]
  };

  return ensureProductWorkflowNodeExecutors(template);
}

export function cloneWorkflowTemplate(
  source: ProductWorkflowTemplate,
  name?: string,
  workspaceId?: string
): ProductWorkflowTemplate {
  const templateId = createTemplateId();
  const now = new Date().toISOString();
  const idMap = new Map<string, string>();

  const nodes = source.nodes.map((node, index) => {
    const nextId = `${node.id}-copy-${index + 1}`;
    idMap.set(node.id, nextId);
    return {
      ...node,
      id: nextId,
      agentVersions: node.agentVersions ? [...node.agentVersions] : [],
      configFields: node.configFields.map((field) => ({ ...field }))
    };
  });

  const edges = source.edges.map((edge, index) => ({
    ...edge,
    id: `${edge.id}-copy-${index + 1}`,
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
    dataMapping: edge.dataMapping ? { ...edge.dataMapping } : undefined
  }));

  return ensureProductWorkflowNodeExecutors({
    ...source,
    id: templateId,
    name: name?.trim() || `${source.name} 副本`,
    status: "draft",
    workspaceId: workspaceId?.trim() || source.workspaceId || DEFAULT_WORKSPACE_ID,
    updatedAt: now,
    nodes,
    edges,
    versions: []
  });
}

export function sanitizeImportedTemplate(
  raw: ProductWorkflowTemplate,
  workspaceId?: string
): ProductWorkflowTemplate {
  if (!raw.id || !raw.name || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new Error("导入模板格式无效");
  }

  return ensureProductWorkflowNodeExecutors({
    ...raw,
    id: createTemplateId(),
    status: raw.status === "published" ? "draft" : raw.status ?? "draft",
    workspaceId: workspaceId?.trim() || raw.workspaceId || DEFAULT_WORKSPACE_ID,
    updatedAt: new Date().toISOString(),
    nodes: raw.nodes,
    edges: raw.edges,
    versions: []
  });
}

import {
  ensureProductWorkflowNodeExecutors,
  type ProductWorkflowTemplate,
  type ProductWorkflowTemplateVersion
} from "@meeting-flow/shared";

function cloneNodes(nodes: ProductWorkflowTemplate["nodes"]) {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    inputs: [...node.inputs],
    outputs: [...node.outputs],
    configFields: node.configFields.map((field) => ({ ...field })),
    agentVersions: node.agentVersions ? node.agentVersions.map((version) => ({ ...version })) : undefined,
    agentInputSchema: node.agentInputSchema ? node.agentInputSchema.map((field) => ({ ...field })) : undefined,
    agentOutputSchema: node.agentOutputSchema ? node.agentOutputSchema.map((field) => ({ ...field })) : undefined,
    agentPromptConfig: node.agentPromptConfig ? { ...node.agentPromptConfig } : undefined,
    executor: node.executor ? { ...node.executor, inputMapping: { ...node.executor.inputMapping }, outputMapping: { ...node.executor.outputMapping } } : undefined
  }));
}

function cloneEdges(edges: ProductWorkflowTemplate["edges"]) {
  return edges.map((edge) => ({
    ...edge,
    dataMapping: edge.dataMapping ? { ...edge.dataMapping } : undefined
  }));
}

export function demotePublishedTemplateVersions(
  versions: ProductWorkflowTemplateVersion[],
  nextPublishedId: string
) {
  return versions.map((version) =>
    version.id !== nextPublishedId && version.status === "published"
      ? { ...version, status: "snapshot" as const }
      : version
  );
}

export function buildWorkflowTemplateVersion(
  template: ProductWorkflowTemplate,
  status: ProductWorkflowTemplateVersion["status"],
  summary: string,
  createdBy: string
): ProductWorkflowTemplateVersion {
  const createdAt = new Date().toISOString();
  const versionIndex = (template.versions?.length ?? 0) + 1;

  return {
    id: `${template.id}-version-${Date.now()}`,
    version: `v${versionIndex}`,
    templateId: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    status,
    templateStatus: template.status,
    summary,
    createdBy,
    createdAt,
    nodes: cloneNodes(template.nodes),
    edges: cloneEdges(template.edges)
  };
}

export function applyWorkflowTemplateVersion(
  template: ProductWorkflowTemplate,
  version: ProductWorkflowTemplateVersion
): ProductWorkflowTemplate {
  return ensureProductWorkflowNodeExecutors({
    ...template,
    name: version.name,
    description: version.description,
    category: version.category,
    status: version.templateStatus,
    nodes: cloneNodes(version.nodes),
    edges: cloneEdges(version.edges),
    updatedAt: new Date().toISOString()
  });
}

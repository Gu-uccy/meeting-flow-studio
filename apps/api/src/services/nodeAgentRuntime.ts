import type { AiApplicationVersion, ProductWorkflowNode } from "@meeting-flow/shared";

export type ResolvedNodeAgentRuntime = {
  node: ProductWorkflowNode;
  publishedVersion: AiApplicationVersion | null;
};

export function resolvePublishedNodeRuntime(node: ProductWorkflowNode): ResolvedNodeAgentRuntime {
  const publishedVersion = node.agentVersions?.find((version) => version.status === "published") ?? null;

  if (!publishedVersion) {
    return { node, publishedVersion: null };
  }

  return {
    node: {
      ...node,
      agentInputSchema: publishedVersion.inputSchema,
      agentOutputSchema: publishedVersion.outputSchema,
      agentPromptConfig: publishedVersion.promptConfig,
      executor: publishedVersion.executor
    },
    publishedVersion
  };
}

export function demotePublishedVersions(
  versions: AiApplicationVersion[],
  nextPublishedId: string
): AiApplicationVersion[] {
  return versions.map((version) =>
    version.id !== nextPublishedId && version.status === "published"
      ? { ...version, status: "snapshot" as const }
      : version
  );
}

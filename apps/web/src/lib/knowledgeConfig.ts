import type { ProductWorkflowNode } from "@meeting-flow/shared";

export type KnowledgeRetrievalConfig = {
  maxDocs: number;
  missingPolicy?: string;
  sources?: string;
};

function readNodeConfigValue(node: ProductWorkflowNode, key: string) {
  return node.configFields.find((field) => field.key === key)?.value.trim() ?? "";
}

export function getKnowledgeConfigFromNode(node: ProductWorkflowNode | null | undefined): KnowledgeRetrievalConfig {
  if (!node) {
    return { maxDocs: 8 };
  }

  const maxDocs = Number(readNodeConfigValue(node, "maxDocs")) || 8;
  const sources = readNodeConfigValue(node, "sources");
  const missingPolicy = readNodeConfigValue(node, "missingPolicy");

  return {
    maxDocs,
    ...(sources ? { sources } : {}),
    ...(missingPolicy ? { missingPolicy } : {})
  };
}

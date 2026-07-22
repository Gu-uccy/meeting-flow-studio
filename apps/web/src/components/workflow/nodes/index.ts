import type { NodeTypes } from "reactflow";
import { ActionNode } from "./ActionNode";
import { AiNode } from "./AiNode";
import { BaseWorkflowNode } from "./BaseWorkflowNode";
import { DecisionNode } from "./DecisionNode";
import { KnowledgeNode } from "./KnowledgeNode";
import { TriggerNode } from "./TriggerNode";

export const workflowNodeTypes: NodeTypes = {
  trigger: TriggerNode,
  ai: AiNode,
  decision: DecisionNode,
  action: ActionNode,
  knowledge: KnowledgeNode
};

export { ActionNode, AiNode, BaseWorkflowNode, DecisionNode, KnowledgeNode, TriggerNode };

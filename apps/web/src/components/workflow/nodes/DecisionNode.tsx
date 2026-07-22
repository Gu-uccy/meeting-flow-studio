import type { NodeProps } from "reactflow";

import type { WorkflowNodeData } from "../workflowPanelTypes";

import { BaseWorkflowNode } from "./BaseWorkflowNode";



export function DecisionNode(props: NodeProps<WorkflowNodeData>) {

  return <BaseWorkflowNode {...props} />;

}



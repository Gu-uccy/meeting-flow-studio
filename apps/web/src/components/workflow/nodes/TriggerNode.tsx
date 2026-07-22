import type { NodeProps } from "reactflow";

import type { WorkflowNodeData } from "../workflowPanelTypes";

import { BaseWorkflowNode } from "./BaseWorkflowNode";



export function TriggerNode(props: NodeProps<WorkflowNodeData>) {

  return <BaseWorkflowNode {...props} />;

}



import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { meetingNodeKindLabels } from "@meeting-flow/shared";
import { toneByKind } from "../workflowPanelUtils";
import type { WorkflowNodeData } from "../workflowPanelTypes";

export const workflowNodeStateLabels: Record<WorkflowNodeData["state"], string> = {
  done: "已完成",
  running: "运行中",
  waiting: "等待",
  blocked: "阻塞",
  optional: "跳过"
};

export const workflowNodeStateBadgeClass: Record<WorkflowNodeData["state"], string> = {
  done: "node-state-badge--success",
  running: "node-state-badge--running",
  waiting: "node-state-badge--pending",
  blocked: "node-state-badge--blocked",
  optional: "node-state-badge--skipped"
};

export const workflowNodeHandleStyle: CSSProperties = {
  width: 10,
  height: 10,
  border: "2px solid #ffffff",
  boxShadow: "0 0 0 1px #94a3b8",
  background: "#e2e8f0"
};

export function BaseWorkflowNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  const tone = toneByKind[data.kind] ?? "#64748b";
  const summary = data.summary.trim();

  return (
    <div
      className={`flow-node ide-flow-node flow-node--${data.kind} flow-node--state-${data.state}${
        selected ? " is-selected" : ""
      }`}
      style={{ "--node-tone": tone } as CSSProperties}
    >
      <Handle
        isConnectable
        className="ide-flow-node__handle ide-flow-node__handle--target"
        position={Position.Left}
        style={{ ...workflowNodeHandleStyle, background: "#ffffff", borderColor: tone }}
        type="target"
      />
      <div className="flow-node__core ide-flow-node__core">
        <div className="ide-flow-node__header">
          <span className="ide-flow-node__kind">{meetingNodeKindLabels[data.kind]}</span>
          <span className={`node-state-badge ide-flow-node__status ${workflowNodeStateBadgeClass[data.state]}`}>
            {data.state === "running" ? <i aria-hidden="true" className="ide-flow-node__pulse" /> : null}
            {workflowNodeStateLabels[data.state]}
          </span>
        </div>
        <strong className="ide-flow-node__title">{data.title}</strong>
        {summary ? <p className="ide-flow-node__summary">{summary}</p> : null}
        {data.owner ? (
          <div className="ide-flow-node__meta">
            <code>{data.owner}</code>
          </div>
        ) : null}
      </div>
      <Handle
        isConnectable
        className="ide-flow-node__handle ide-flow-node__handle--source"
        position={Position.Right}
        style={{ ...workflowNodeHandleStyle, background: tone, borderColor: tone }}
        type="source"
      />
    </div>
  );
}

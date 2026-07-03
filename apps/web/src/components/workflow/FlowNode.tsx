import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { meetingNodeKindLabels } from "@meeting-flow/shared";

type WorkflowNodeData = {
  title: string;
  summary: string;
  kind: keyof typeof meetingNodeKindLabels;
  state: "done" | "running" | "waiting" | "blocked" | "optional";
  owner: string;
};

const toneByKind: Record<string, string> = {
  trigger: "#8fc0c5",
  ai: "#8fc0c5",
  knowledge: "#7c3aed",
  decision: "#d97706",
  action: "#dc2626"
};

const stateLabels: Record<WorkflowNodeData["state"], string> = {
  done: "已完成",
  running: "运行中",
  waiting: "等待",
  blocked: "阻塞",
  optional: "跳过"
};

const handleStyle: CSSProperties = {
  width: 11,
  height: 11,
  border: "2px solid #ffffff",
  boxShadow: "0 0 0 1px #94a3b8",
  background: "#e2e8f0"
};

export function FlowNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  const tone = toneByKind[data.kind] ?? "#64748b";

  return (
    <div
      className={`flow-node ide-flow-node flow-node--${data.kind} flow-node--state-${data.state}${
        selected ? " is-selected" : ""
      }`}
      style={
        {
          "--node-tone": tone
        } as CSSProperties
      }
    >
      <div className="flow-node__core ide-flow-node__core">
        <Handle
          type="target"
          position={Position.Left}
          style={{ ...handleStyle, background: "#ffffff", borderColor: tone }}
          isConnectable={true}
        />
        <div className="ide-flow-node__header">
          <span>{meetingNodeKindLabels[data.kind]}</span>
          <em>{stateLabels[data.state]}</em>
        </div>
        <strong>{data.title}</strong>
        <p>{data.summary}</p>
        <div className="ide-flow-node__ports">
          <code>{data.owner}</code>
          <i aria-hidden="true" />
        </div>
        <Handle
          type="source"
          position={Position.Right}
          style={{ ...handleStyle, background: tone, borderColor: tone }}
          isConnectable={true}
        />
      </div>
    </div>
  );
}

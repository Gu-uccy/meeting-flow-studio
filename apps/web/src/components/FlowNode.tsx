import { Handle, Position, type NodeProps } from "reactflow";

type WorkflowNodeData = {
  title: string;
  summary: string;
  kind: string;
};

const toneByKind: Record<string, string> = {
  trigger: "var(--tone-trigger)",
  ai: "var(--tone-ai)",
  knowledge: "var(--tone-knowledge)",
  decision: "var(--tone-decision)",
  action: "var(--tone-action)"
};

export function FlowNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={`flow-node${selected ? " is-selected" : ""}`}
      style={{
        borderColor: toneByKind[data.kind] ?? "var(--card-border)"
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="flow-node__kind">{data.kind}</span>
      <strong className="flow-node__title">{data.title}</strong>
      <p className="flow-node__summary">{data.summary}</p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
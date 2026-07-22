import { meetingNodeKindLabels, meetingNodeKinds } from "@meeting-flow/shared";
import { toneByKind } from "../workflowPanelUtils";

export function WorkflowNodePalette() {
  return (
    <aside className="workflow-editor__palette" aria-label="节点类型">
      <div className="workflow-editor__palette-head">
        <strong>节点库</strong>
      </div>
      <div className="workflow-editor__palette-list">
        {meetingNodeKinds.map((kind) => (
          <div
            className="workflow-editor__palette-item"
            draggable
            key={kind}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/reactflow-kind", kind);
              event.dataTransfer.effectAllowed = "move";
            }}
            style={{ ["--node-tone" as string]: toneByKind[kind] }}
            title={`拖入 ${meetingNodeKindLabels[kind]} 节点`}
          >
            <i aria-hidden="true" />
            <span>{meetingNodeKindLabels[kind]}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

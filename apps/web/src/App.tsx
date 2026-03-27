import { useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node
} from "reactflow";
import {
  defaultWorkflowBlueprint,
  meetingNodeCatalog,
  type MeetingNodeKind
} from "@meeting-flow/shared";
import { FlowNode } from "./components/FlowNode";

type WorkflowNodeData = {
  title: string;
  summary: string;
  kind: MeetingNodeKind;
};

const nodeTypes = {
  workflow: FlowNode
};

const initialNodes: Array<Node<WorkflowNodeData>> = defaultWorkflowBlueprint.steps.map(
  (step) => ({
    id: step.id,
    type: "workflow",
    position: { x: step.x, y: step.y },
    data: {
      title: step.title,
      summary: step.summary,
      kind: step.kind
    }
  })
);

const initialEdges: Edge[] = defaultWorkflowBlueprint.connections.map((connection) => ({
  id: `${connection.source}-${connection.target}`,
  source: connection.source,
  target: connection.target,
  animated: true,
  style: {
    stroke: "rgba(207, 244, 122, 0.9)",
    strokeWidth: 2
  }
}));

function nextNodePosition(nodeCount: number) {
  return {
    x: 200 + (nodeCount % 3) * 280,
    y: 320 + Math.floor(nodeCount / 3) * 180
  };
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedKind, setSelectedKind] = useState<MeetingNodeKind>("ai");

  const selectedNode = nodes.find((node) => node.selected) ?? nodes[1] ?? nodes[0];

  function handleConnect(connection: Connection) {
    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          animated: true,
          style: {
            stroke: "rgba(207, 244, 122, 0.9)",
            strokeWidth: 2
          }
        },
        currentEdges
      )
    );
  }

  function addNode(kind: MeetingNodeKind) {
    const template = meetingNodeCatalog.find((item) => item.kind === kind);

    if (!template) {
      return;
    }

    const position = nextNodePosition(nodes.length);

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: `${kind}-${currentNodes.length + 1}`,
        type: "workflow",
        position,
        data: {
          title: template.title,
          summary: template.summary,
          kind: template.kind
        }
      }
    ]);
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Visual AI Meeting Ops</p>
          <h1>Meeting Flow Studio</h1>
          <p className="hero-copy">
            Build intake, agenda generation, stakeholder routing, and follow-up automations on
            one React Flow canvas.
          </p>
        </div>
        <div className="hero-metrics">
          <article>
            <span>Active workflow</span>
            <strong>{defaultWorkflowBlueprint.name}</strong>
          </article>
          <article>
            <span>Starter nodes</span>
            <strong>{nodes.length}</strong>
          </article>
          <article>
            <span>Connected edges</span>
            <strong>{edges.length}</strong>
          </article>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar glass-panel">
          <div className="section-head">
            <span>Node palette</span>
            <strong>Meeting automation blocks</strong>
          </div>
          <div className="template-grid">
            {meetingNodeCatalog.map((item) => (
              <button
                key={item.kind}
                className={`template-card${selectedKind === item.kind ? " is-active" : ""}`}
                onClick={() => setSelectedKind(item.kind)}
                type="button"
              >
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </button>
            ))}
          </div>
          <button className="primary-button" onClick={() => addNode(selectedKind)} type="button">
            Add selected node
          </button>
        </aside>

        <section className="canvas glass-panel">
          <ReactFlow
            fitView
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
          >
            <Panel position="top-left">
              <div className="canvas-pill">Drag nodes to sketch your meeting system</div>
            </Panel>
            <MiniMap
              nodeColor="#c8ff72"
              maskColor="rgba(7, 16, 25, 0.72)"
              pannable
              zoomable
            />
            <Controls />
            <Background color="rgba(255,255,255,0.08)" gap={28} />
          </ReactFlow>
        </section>

        <aside className="inspector glass-panel">
          <div className="section-head">
            <span>Inspector</span>
            <strong>{selectedNode?.data.title ?? "Select a node"}</strong>
          </div>
          <div className="detail-stack">
            <article>
              <span>Node type</span>
              <strong>{selectedNode?.data.kind ?? "n/a"}</strong>
            </article>
            <article>
              <span>Summary</span>
              <p>{selectedNode?.data.summary ?? "Choose a node on the canvas to inspect it."}</p>
            </article>
            <article>
              <span>Recommended integrations</span>
              <p>Calendar, email, CRM, project tracker, and meeting transcripts.</p>
            </article>
            <article>
              <span>Suggested AI guardrails</span>
              <p>Redact sensitive notes, enforce attendee limits, and require approval on exec calls.</p>
            </article>
          </div>
        </aside>
      </main>
    </div>
  );
}
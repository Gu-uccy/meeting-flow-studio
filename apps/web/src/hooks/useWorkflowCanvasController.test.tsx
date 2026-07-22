import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Edge, Node } from "reactflow";
import { act, type DragEvent as ReactDragEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MeetingRecord,
  ProductWorkflowEdge,
  ProductWorkflowNode,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";
import type { WorkflowNodeData } from "../components/workflow/workflowPanelTypes";
import {
  useWorkflowCanvasController,
  type UseWorkflowCanvasControllerOptions
} from "./useWorkflowCanvasController";
import { useWorkflowCanvasStore } from "../stores/workflowCanvasStore";
import { useWorkflowEditorStore } from "../stores/workflowEditorStore";
import { useWorkflowExecutionStore } from "../stores/workflowExecutionStore";

function resetWorkflowStores() {
  useWorkflowCanvasStore.getState().resetCanvasStore();
  useWorkflowExecutionStore.getState().resetExecutionStore();
  useWorkflowEditorStore.getState().resetEditorStore();
}

function makeNode(id: string, overrides: Partial<ProductWorkflowNode> = {}): ProductWorkflowNode {
  return {
    id,
    kind: "action",
    title: `Node ${id}`,
    description: `Description ${id}`,
    position: { x: 0, y: 0 },
    owner: "owner",
    inputs: ["input"],
    outputs: ["output"],
    configFields: [{ key: "instruction", label: "执行说明", value: "", kind: "textarea" }],
    ...overrides
  };
}

function makeTemplate(
  id: string,
  category: ProductWorkflowTemplate["category"],
  nodeIds: string[],
  edges: ProductWorkflowEdge[] = []
): ProductWorkflowTemplate {
  return {
    id,
    name: id,
    description: "",
    category,
    status: "published",
    nodes: nodeIds.map((nodeId, index) => makeNode(nodeId, { position: { x: index * 120, y: 40 } })),
    edges,
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function makeRun(
  id: string,
  templateId: string,
  meetingId: string,
  nodeRuns: ProductWorkflowRun["nodeRuns"]
): ProductWorkflowRun {
  return {
    id,
    templateId,
    meetingId,
    name: id,
    status: "running",
    durationSeconds: 0,
    startedAt: "2026-01-01T00:00:00.000Z",
    nodeRuns,
    logs: []
  };
}

function makeMeeting(id: string, type: MeetingRecord["type"]): MeetingRecord {
  return { id, type, status: "scheduled" } as MeetingRecord;
}

function createCallbacks(overrides: Partial<UseWorkflowCanvasControllerOptions> = {}) {
  return {
    onSaveTemplateCanvas: vi.fn<UseWorkflowCanvasControllerOptions["onSaveTemplateCanvas"]>().mockResolvedValue(null),
    onStartWorkflowRun: vi.fn<UseWorkflowCanvasControllerOptions["onStartWorkflowRun"]>().mockResolvedValue(null),
    onAdvanceWorkflowRun: vi.fn<UseWorkflowCanvasControllerOptions["onAdvanceWorkflowRun"]>().mockResolvedValue(null),
    onRetryWorkflowRun: vi.fn<UseWorkflowCanvasControllerOptions["onRetryWorkflowRun"]>().mockResolvedValue(null),
    onCancelWorkflowRun: vi.fn<UseWorkflowCanvasControllerOptions["onCancelWorkflowRun"]>().mockResolvedValue(null),
    ...overrides
  };
}

const weeklyTemplate = makeTemplate("tpl-weekly", "weekly", ["n1", "n2", "n3"], [
  { id: "edge-1", source: "n1", target: "n2", label: "" }
]);
const projectTemplate = makeTemplate("tpl-project", "project", ["p1", "p2"]);
const templates = [weeklyTemplate, projectTemplate];

const weeklyRun = makeRun("run-weekly", "tpl-weekly", "meeting-1", [
  { nodeId: "n1", status: "success" },
  { nodeId: "n2", status: "blocked" },
  { nodeId: "n3", status: "pending" }
]);
const projectRun = makeRun("run-project", "tpl-project", "meeting-2", [
  { nodeId: "p1", status: "running" }
]);

function renderCanvasHook(overrides: Partial<UseWorkflowCanvasControllerOptions> = {}) {
  const callbacks = createCallbacks(overrides);
  const props: UseWorkflowCanvasControllerOptions = {
    selectedMeeting: null,
    workflowTemplates: templates,
    workflowRuns: [weeklyRun, projectRun],
    ...callbacks
  };

  const hook = renderHook(
    (currentProps: UseWorkflowCanvasControllerOptions) => useWorkflowCanvasController(currentProps),
    { initialProps: props }
  );

  return { ...hook, callbacks, props };
}

function CanvasHarness({ options }: { options: UseWorkflowCanvasControllerOptions }) {
  const canvas = useWorkflowCanvasController(options);

  return (
    <div>
      <div ref={canvas.reactFlowWrapper} data-testid="canvas-wrapper" />
      <output data-testid="template-id">{canvas.selectedTemplate?.id ?? "none"}</output>
      <output data-testid="run-id">{canvas.selectedRun?.id ?? "none"}</output>
      <output data-testid="node-id">{canvas.selectedFlowNodeId || "none"}</output>
      <output data-testid="node-count">{canvas.canvasNodes.length}</output>
      <output data-testid="edge-count">{canvas.canvasEdges.length}</output>
      <output data-testid="dirty">{canvas.isCanvasDirty ? "yes" : "no"}</output>
      <button type="button" onClick={() => canvas.handleAddNode()}>新增节点</button>
      <button type="button" onClick={() => void canvas.handleSaveCanvas()}>保存画布</button>
      <button type="button" onClick={() => canvas.handleResetCanvas()}>重置画布</button>
      <button type="button" onClick={() => void canvas.handleStartWorkflowRun()}>启动流程</button>
    </div>
  );
}

describe("useWorkflowCanvasController", () => {
  beforeEach(() => {
    resetWorkflowStores();
  });

  it("auto-matches template, run, and blocked node when meeting changes", async () => {
    const { result, rerender } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => {
      expect(result.current.selectedTemplate?.id).toBe("tpl-weekly");
      expect(result.current.selectedRun?.id).toBe("run-weekly");
      expect(result.current.selectedFlowNodeId).toBe("n2");
    });

    rerender({
      selectedMeeting: makeMeeting("meeting-2", "project"),
      workflowTemplates: templates,
      workflowRuns: [weeklyRun, projectRun],
      ...createCallbacks()
    });

    await waitFor(() => {
      expect(result.current.selectedTemplate?.id).toBe("tpl-project");
      expect(result.current.selectedRun?.id).toBe("run-project");
      expect(result.current.selectedFlowNodeId).toBe("p2");
    });
  });

  it("selectTemplate and selectRun update the active canvas context", async () => {
    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => expect(result.current.selectedTemplate?.id).toBe("tpl-weekly"));

    act(() => {
      result.current.selectTemplate("tpl-project");
    });

    expect(result.current.selectedTemplate?.id).toBe("tpl-project");
    expect(result.current.selectedRun?.id).toBe("run-project");
    expect(result.current.selectedFlowNodeId).toBe("p2");

    act(() => {
      result.current.selectTemplate("tpl-weekly");
    });

    act(() => {
      result.current.selectRun(weeklyRun);
    });

    expect(result.current.selectedRun?.id).toBe("run-weekly");
    expect(result.current.selectedFlowNodeId).toBe("n2");
  });

  it("switches selection between nodes and edges", async () => {
    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => expect(result.current.canvasNodes.length).toBe(3));

    act(() => {
      result.current.handleNodeClick({} as ReactMouseEvent, {
        id: "n3",
        type: "action",
        position: { x: 0, y: 0 },
        data: {} as WorkflowNodeData
      } satisfies Node<WorkflowNodeData>);
    });

    expect(result.current.selectedFlowNodeId).toBe("n3");
    expect(result.current.selectedEdge).toBeNull();

    act(() => {
      result.current.handleEdgeClick({} as ReactMouseEvent, {
        id: "edge-1",
        source: "n1",
        target: "n2"
      } satisfies Edge);
    });

    expect(result.current.selectedEdge?.id).toBe("edge-1");
    expect(result.current.selectedFlowNodeId).toBe("");
    expect(result.current.selectedNode).toBeNull();
  });

  it("double-clicks edge and marks condition field for focus", async () => {
    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => expect(result.current.canvasEdges.length).toBe(1));

    act(() => {
      result.current.handleEdgeDoubleClick({} as ReactMouseEvent, {
        id: "edge-1",
        source: "n1",
        target: "n2"
      } satisfies Edge);
    });

    expect(result.current.selectedEdge?.id).toBe("edge-1");
    expect(useWorkflowEditorStore.getState().focusedEdgeField).toBe("condition");
  });

  it("maps react flow node types from node kind", async () => {
    const decisionTemplate = makeTemplate("tpl-decision", "weekly", ["d1"], []);
    decisionTemplate.nodes[0] = makeNode("d1", { kind: "decision" });

    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly"),
      workflowTemplates: [decisionTemplate],
      workflowRuns: []
    });

    await waitFor(() => expect(result.current.workflowNodes.length).toBe(1));
    expect(result.current.workflowNodes[0]?.type).toBe("decision");
  });

  it("marks conditional edges with conditional class", async () => {
    const conditionalTemplate = makeTemplate("tpl-cond", "weekly", ["n1", "n2"], [
      { id: "edge-cond", source: "n1", target: "n2", label: "yes", condition: "status === \"approved\"" }
    ]);

    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly"),
      workflowTemplates: [conditionalTemplate],
      workflowRuns: []
    });

    await waitFor(() => expect(result.current.workflowEdges.length).toBe(1));
    expect(result.current.workflowEdges[0]?.className).toContain("workflow-edge--conditional");
  });

  it("maps workflow node and edge visual state from the selected run", async () => {
    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => expect(result.current.selectedRun?.id).toBe("run-weekly"));

    const blockedNode = result.current.workflowNodes.find((node) => node.id === "n2");
    const runningEdge = result.current.workflowEdges.find((edge) => edge.id === "edge-1");

    expect(blockedNode?.data.state).toBe("blocked");
    expect(runningEdge?.className).toContain("workflow-edge--blocked");
    expect(result.current.blockedNodeRun?.nodeId).toBe("n2");
    expect(result.current.selectedInputPayload).toEqual([]);
  });

  it("validates connections and appends edges", async () => {
    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => expect(result.current.canvasEdges.length).toBe(1));

    expect(result.current.isValidConnection({ source: "n1", target: "n1", sourceHandle: null, targetHandle: null })).toBe(false);
    expect(result.current.isValidConnection({ source: "n1", target: "n2", sourceHandle: null, targetHandle: null })).toBe(false);

    act(() => {
      result.current.handleConnect({ source: "n2", target: "n3", sourceHandle: null, targetHandle: null });
    });

    expect(result.current.canvasEdges).toHaveLength(2);
    expect(result.current.isCanvasDirty).toBe(true);
    expect(result.current.selectedEdge?.source).toBe("n2");
    expect(result.current.selectedEdge?.target).toBe("n3");
  });

  it("adds nodes through RTL interactions and deletes the selected node", async () => {
    const user = userEvent.setup();
    const callbacks = createCallbacks();

    render(
      <CanvasHarness
        options={{
          selectedMeeting: makeMeeting("meeting-1", "weekly"),
          workflowTemplates: templates,
          workflowRuns: [weeklyRun],
          ...callbacks
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId("node-count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: "新增节点" }));

    expect(screen.getByTestId("node-count")).toHaveTextContent("4");
    expect(screen.getByTestId("dirty")).toHaveTextContent("yes");

    resetWorkflowStores();

    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly"),
      workflowRuns: [weeklyRun]
    });

    await waitFor(() => expect(result.current.canvasNodes.length).toBe(3));

    act(() => {
      result.current.handleAddNode();
    });

    const addedNodeId = result.current.selectedNode!.id;
    expect(result.current.canvasNodes).toHaveLength(4);

    act(() => {
      result.current.handleDeleteSelectedNode();
    });

    expect(result.current.canvasNodes.some((node) => node.id === addedNodeId)).toBe(false);
    expect(result.current.canvasNodes).toHaveLength(3);
    expect(result.current.isCanvasDirty).toBe(true);
  });

  it("resets dirty canvas state and persists through save callback", async () => {
    const user = userEvent.setup();
    const savedTemplate = makeTemplate("tpl-weekly", "weekly", ["n1", "n2", "n3"], [
      { id: "edge-1", source: "n1", target: "n2", label: "saved" }
    ]);
    savedTemplate.updatedAt = "2026-01-02T00:00:00.000Z";

    const callbacks = createCallbacks({
      onSaveTemplateCanvas: vi.fn().mockResolvedValue(savedTemplate)
    });

    render(
      <CanvasHarness
        options={{
          selectedMeeting: makeMeeting("meeting-1", "weekly"),
          workflowTemplates: templates,
          workflowRuns: [weeklyRun],
          ...callbacks
        }}
      />
    );

    await waitFor(() => expect(screen.getByTestId("dirty")).toHaveTextContent("no"));
    await user.click(screen.getByRole("button", { name: "新增节点" }));
    expect(screen.getByTestId("dirty")).toHaveTextContent("yes");

    await user.click(screen.getByRole("button", { name: "重置画布" }));
    expect(screen.getByTestId("dirty")).toHaveTextContent("no");
    expect(screen.getByTestId("node-count")).toHaveTextContent("3");

    await user.click(screen.getByRole("button", { name: "新增节点" }));
    await user.click(screen.getByRole("button", { name: "保存画布" }));

    await waitFor(() => {
      expect(callbacks.onSaveTemplateCanvas).toHaveBeenCalledWith("tpl-weekly", expect.any(Array), expect.any(Array));
      expect(screen.getByTestId("dirty")).toHaveTextContent("no");
      expect(screen.getByTestId("edge-count")).toHaveTextContent("1");
    });
  });

  it("starts workflow run and selects the returned run", async () => {
    const nextRun = makeRun("run-new", "tpl-weekly", "meeting-1", [
      { nodeId: "n1", status: "running" }
    ]);
    const callbacks = createCallbacks({
      onStartWorkflowRun: vi.fn().mockResolvedValue(nextRun)
    });

    const { result, rerender } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly"),
      ...callbacks
    });

    await waitFor(() => expect(result.current.selectedRun?.id).toBe("run-weekly"));

    await act(async () => {
      await result.current.handleStartWorkflowRun();
    });

    rerender({
      selectedMeeting: makeMeeting("meeting-1", "weekly"),
      workflowTemplates: templates,
      workflowRuns: [weeklyRun, nextRun],
      ...callbacks
    });

    await waitFor(() => {
      expect(callbacks.onStartWorkflowRun).toHaveBeenCalledWith("tpl-weekly");
      expect(result.current.selectedRun?.id).toBe("run-new");
      expect(result.current.selectedFlowNodeId).toBe("n1");
      expect(result.current.resolutionNote).toBe("");
    });
  });

  it("creates dropped nodes when react flow refs are available", async () => {
    const { result } = renderCanvasHook({
      selectedMeeting: makeMeeting("meeting-1", "weekly")
    });

    await waitFor(() => expect(result.current.canvasNodes.length).toBe(3));

    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    Object.defineProperty(wrapper, "getBoundingClientRect", {
      value: () => ({ left: 10, top: 20, width: 800, height: 600 })
    });

    act(() => {
      (result.current.reactFlowWrapper as { current: HTMLDivElement | null }).current = wrapper;
      result.current.reactFlowInstance.current = {
        project: vi.fn().mockReturnValue({ x: 140, y: 180 })
      } as never;
    });

    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        clientX: 150,
        clientY: 200,
        dataTransfer: {
          getData: vi.fn().mockReturnValue("ai")
        }
      } as unknown as ReactDragEvent<HTMLDivElement>);
    });

    expect(result.current.canvasNodes).toHaveLength(4);
    expect(result.current.canvasNodes.at(-1)?.kind).toBe("ai");
    expect(result.current.selectedFlowNodeId).toBe(result.current.canvasNodes.at(-1)?.id);
    expect(result.current.isCanvasDirty).toBe(true);
  });
});

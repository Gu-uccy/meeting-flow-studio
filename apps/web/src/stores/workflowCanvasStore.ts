import { create } from "zustand";
import type { ProductWorkflowEdge, ProductWorkflowNode } from "@meeting-flow/shared";

type EditorTarget = { kind: "node" | "edge"; id: string } | null;

type WorkflowCanvasState = {
  canvasEdges: ProductWorkflowEdge[];
  canvasNodes: ProductWorkflowNode[];
  editorTarget: EditorTarget;
  isCanvasDirty: boolean;
  selectedEdgeId: string;
  clearEditorSelection: () => void;
  loadCanvas: (nodes: ProductWorkflowNode[], edges: ProductWorkflowEdge[]) => void;
  markCanvasSaved: (nodes: ProductWorkflowNode[], edges: ProductWorkflowEdge[]) => void;
  setCanvasDirty: (value: boolean) => void;
  setCanvasEdges: (edges: ProductWorkflowEdge[] | ((current: ProductWorkflowEdge[]) => ProductWorkflowEdge[])) => void;
  setCanvasNodes: (nodes: ProductWorkflowNode[] | ((current: ProductWorkflowNode[]) => ProductWorkflowNode[])) => void;
  setEditorTarget: (target: EditorTarget) => void;
  setSelectedEdgeId: (edgeId: string) => void;
  resetCanvasStore: () => void;
};

const initialCanvasState = {
  canvasEdges: [] as ProductWorkflowEdge[],
  canvasNodes: [] as ProductWorkflowNode[],
  editorTarget: null as EditorTarget,
  isCanvasDirty: false,
  selectedEdgeId: ""
};

export const useWorkflowCanvasStore = create<WorkflowCanvasState>((set) => ({
  ...initialCanvasState,
  canvasEdges: [],
  canvasNodes: [],
  editorTarget: null,
  isCanvasDirty: false,
  selectedEdgeId: "",
  clearEditorSelection: () => set({ editorTarget: null, selectedEdgeId: "" }),
  loadCanvas: (nodes, edges) => set({
    canvasEdges: edges.map((edge) => ({ ...edge })),
    canvasNodes: nodes.map((node) => ({ ...node })),
    editorTarget: null,
    isCanvasDirty: false,
    selectedEdgeId: ""
  }),
  markCanvasSaved: (nodes, edges) => set({
    canvasEdges: edges.map((edge) => ({ ...edge })),
    canvasNodes: nodes.map((node) => ({ ...node })),
    isCanvasDirty: false,
    selectedEdgeId: ""
  }),
  setCanvasDirty: (value) => set({ isCanvasDirty: value }),
  setCanvasEdges: (edges) => set((state) => ({
    canvasEdges: typeof edges === "function" ? edges(state.canvasEdges) : edges
  })),
  setCanvasNodes: (nodes) => set((state) => ({
    canvasNodes: typeof nodes === "function" ? nodes(state.canvasNodes) : nodes
  })),
  setEditorTarget: (target) => set({ editorTarget: target }),
  setSelectedEdgeId: (edgeId) => set({ selectedEdgeId: edgeId }),
  resetCanvasStore: () => set(initialCanvasState)
}));

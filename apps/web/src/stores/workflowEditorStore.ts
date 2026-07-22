import { create } from "zustand";

type WorkflowEditorState = {
  focusedEdgeField: "condition" | null;
  isCanvasZoomFocused: boolean;
  setCanvasZoomFocused: (value: boolean) => void;
  setFocusedEdgeField: (field: "condition" | null) => void;
  resetEditorStore: () => void;
};

const initialEditorState = {
  focusedEdgeField: null as "condition" | null,
  isCanvasZoomFocused: false
};

export const useWorkflowEditorStore = create<WorkflowEditorState>((set) => ({
  ...initialEditorState,
  setCanvasZoomFocused: (value) => set({ isCanvasZoomFocused: value }),
  setFocusedEdgeField: (field) => set({ focusedEdgeField: field }),
  resetEditorStore: () => set(initialEditorState)
}));

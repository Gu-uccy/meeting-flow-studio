import { create } from "zustand";
import type { ProductWorkflowRunStatus } from "@meeting-flow/shared";

type WorkflowExecutionState = {
  isExecutionDockOpen: boolean;
  isRunDetailOpen: boolean;
  resolutionNote: string;
  runStatusFilter: "all" | ProductWorkflowRunStatus;
  selectedFlowNodeId: string;
  selectedRunId: string;
  selectedTemplateId: string;
  resetExecutionSelection: () => void;
  setExecutionDockOpen: (value: boolean) => void;
  toggleExecutionDock: () => void;
  setResolutionNote: (value: string) => void;
  setRunDetailOpen: (value: boolean) => void;
  setRunStatusFilter: (value: "all" | ProductWorkflowRunStatus) => void;
  setSelectedFlowNodeId: (nodeId: string) => void;
  setSelectedRunId: (runId: string) => void;
  setSelectedTemplateId: (templateId: string) => void;
  resetExecutionStore: () => void;
};

const initialExecutionState = {
  isExecutionDockOpen: false,
  isRunDetailOpen: false,
  resolutionNote: "",
  runStatusFilter: "all" as const,
  selectedFlowNodeId: "",
  selectedRunId: "",
  selectedTemplateId: ""
};

export const useWorkflowExecutionStore = create<WorkflowExecutionState>((set) => ({
  ...initialExecutionState,
  resetExecutionSelection: () => set({
    resolutionNote: "",
    selectedFlowNodeId: "",
    selectedRunId: "",
    selectedTemplateId: ""
  }),
  resetExecutionStore: () => set(initialExecutionState),
  setExecutionDockOpen: (value) => set({ isExecutionDockOpen: value }),
  toggleExecutionDock: () => set((state) => ({ isExecutionDockOpen: !state.isExecutionDockOpen })),
  setResolutionNote: (value) => set({ resolutionNote: value }),
  setRunDetailOpen: (value) => set({ isRunDetailOpen: value }),
  setRunStatusFilter: (value) => set({ runStatusFilter: value }),
  setSelectedFlowNodeId: (nodeId) => set({ selectedFlowNodeId: nodeId }),
  setSelectedRunId: (runId) => set({ selectedRunId: runId }),
  setSelectedTemplateId: (templateId) => set({ selectedTemplateId: templateId })
}));

import { create } from "zustand";

export type NodeAgentStudioTab = "configure" | "debug" | "versions";

type NodeAgentState = {
  activeStudioTab: NodeAgentStudioTab;
  nodeAgentRuntimeFilter: "all" | "ai" | "system";
  nodeAgentSearchQuery: string;
  selectedNodeAgentKey: string;
  resetNodeAgentStore: () => void;
  setActiveStudioTab: (tab: NodeAgentStudioTab) => void;
  setNodeAgentRuntimeFilter: (value: "all" | "ai" | "system") => void;
  setNodeAgentSearchQuery: (value: string) => void;
  setSelectedNodeAgentKey: (key: string) => void;
};

export const useNodeAgentStore = create<NodeAgentState>((set) => ({
  activeStudioTab: "configure",
  nodeAgentRuntimeFilter: "all",
  nodeAgentSearchQuery: "",
  selectedNodeAgentKey: "",
  resetNodeAgentStore: () => set({
    activeStudioTab: "configure",
    nodeAgentRuntimeFilter: "all",
    nodeAgentSearchQuery: "",
    selectedNodeAgentKey: ""
  }),
  setActiveStudioTab: (tab) => set({ activeStudioTab: tab }),
  setNodeAgentRuntimeFilter: (value) => set({ nodeAgentRuntimeFilter: value }),
  setNodeAgentSearchQuery: (value) => set({ nodeAgentSearchQuery: value }),
  setSelectedNodeAgentKey: (key) => set({ selectedNodeAgentKey: key })
}));

import { create } from "zustand";
import type { RunsConsoleFilters } from "../lib/runsConsoleUtils";

type RunsConsoleState = {
  filters: RunsConsoleFilters;
  isDetailOpen: boolean;
  resolutionNote: string;
  selectedRunId: string;
  resetRunsConsoleStore: () => void;
  setDetailOpen: (value: boolean) => void;
  setFilters: (filters: RunsConsoleFilters) => void;
  setResolutionNote: (value: string) => void;
  setSelectedRunId: (runId: string) => void;
  updateFilters: (patch: Partial<RunsConsoleFilters>) => void;
};

const initialFilters: RunsConsoleFilters = {
  meetingId: "",
  ownerScope: "all",
  search: "",
  status: "all",
  templateId: ""
};

export const useRunsConsoleStore = create<RunsConsoleState>((set) => ({
  filters: initialFilters,
  isDetailOpen: false,
  resolutionNote: "",
  selectedRunId: "",
  resetRunsConsoleStore: () => set({
    filters: initialFilters,
    isDetailOpen: false,
    resolutionNote: "",
    selectedRunId: ""
  }),
  setDetailOpen: (value) => set({ isDetailOpen: value }),
  setFilters: (filters) => set({ filters }),
  setResolutionNote: (value) => set({ resolutionNote: value }),
  setSelectedRunId: (runId) => set({ selectedRunId: runId, resolutionNote: "" }),
  updateFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } }))
}));

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { useAuth } from "./AuthContext";
import { useMeetings } from "../hooks/useMeetings";
import { useGoogleCalendarIntegration } from "../hooks/useGoogleCalendarIntegration";
import { useFeishuCalendarIntegration } from "../hooks/useFeishuCalendarIntegration";
import { useAiSettings } from "../hooks/useAiSettings";
import { useMeetingAgent } from "../hooks/useMeetingAgent";
import { useMeetingMemories } from "../hooks/useMeetingMemories";
import { useWorkflowLibrary } from "../hooks/useWorkflowLibrary";
import type { MeetingAgentRun, ProductWorkflowRun } from "@meeting-flow/shared";

export type WorkbenchView = "workspace" | "apps" | "account";

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
}

type WorkbenchContextValue = {
  workbenchView: WorkbenchView;
  setWorkbenchView: (view: WorkbenchView) => void;
  pendingNodeAgentKey: string | null;
  openNodeAgent: (templateId: string, nodeId: string) => void;
  clearPendingNodeAgent: () => void;
  meetings: ReturnType<typeof useMeetings>;
  workflow: ReturnType<typeof useWorkflowLibrary> & {
    advanceRunAndReloadMemories: (runId: string, resolutionNote: string) => Promise<ProductWorkflowRun | null>;
    retryRunAndReloadMemories: (runId: string) => Promise<ProductWorkflowRun | null>;
    startRunForSelectedMeeting: (templateId: string) => Promise<ProductWorkflowRun | null>;
  };
  googleCalendar: ReturnType<typeof useGoogleCalendarIntegration>;
  feishuCalendar: ReturnType<typeof useFeishuCalendarIntegration>;
  aiSettings: ReturnType<typeof useAiSettings>;
  memories: ReturnType<typeof useMeetingMemories>;
  agent: ReturnType<typeof useMeetingAgent> & {
    runAgentAndReload: () => Promise<MeetingAgentRun | null>;
  };
  modals: {
    isCreateOpen: boolean;
    openCreate: () => void;
    closeCreate: () => void;
    isDetailOpen: boolean;
    isDetailEditing: boolean;
    setDetailEditing: (value: boolean) => void;
    openDetail: (meetingId: string) => void;
    openEdit: (meetingId: string) => void;
    closeDetail: () => void;
    submitCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
    deleteSelectedMeeting: () => Promise<boolean>;
  };
  derived: {
    todayMeetingCount: number;
    modelRuntimeLabel: string;
  };
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

type WorkbenchProviderProps = {
  children: ReactNode;
};

export function WorkbenchProvider({ children }: WorkbenchProviderProps) {
  const { user } = useAuth();
  const isEnabled = Boolean(user);

  const [workbenchView, setWorkbenchView] = useState<WorkbenchView>("workspace");
  const [pendingNodeAgentKey, setPendingNodeAgentKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailEditing, setIsDetailEditing] = useState(false);

  const meetings = useMeetings(isEnabled);
  const aiSettings = useAiSettings(isEnabled);
  const googleCalendar = useGoogleCalendarIntegration(isEnabled, meetings.upsertMeeting);
  const feishuCalendar = useFeishuCalendarIntegration(isEnabled, meetings.upsertMeeting);
  const workflowBase = useWorkflowLibrary(isEnabled);
  const memories = useMeetingMemories(isEnabled, meetings.selectedMeeting?.id ?? "");
  const agentBase = useMeetingAgent(isEnabled, meetings.selectedMeeting?.id ?? "");

  const advanceRunAndReloadMemories = useCallback(async (runId: string, resolutionNote: string) => {
    const run = await workflowBase.advanceWorkflowRun(runId, resolutionNote);
    if (run) {
      void memories.reloadMemories();
      void meetings.reloadMeetings();
    }
    return run;
  }, [meetings.reloadMeetings, memories.reloadMemories, workflowBase.advanceWorkflowRun]);

  const retryRunAndReloadMemories = useCallback(async (runId: string) => {
    const run = await workflowBase.retryWorkflowRun(runId);
    if (run) {
      void memories.reloadMemories();
      void meetings.reloadMeetings();
    }
    return run;
  }, [meetings.reloadMeetings, memories.reloadMemories, workflowBase.retryWorkflowRun]);

  const startRunForSelectedMeeting = useCallback(async (templateId: string) => {
    if (!meetings.selectedMeeting) {
      return null;
    }

    const run = await workflowBase.startWorkflowRun(meetings.selectedMeeting.id, templateId);
    if (run) {
      void memories.reloadMemories();
      void meetings.reloadMeetings();
    }
    return run;
  }, [meetings.reloadMeetings, meetings.selectedMeeting, memories.reloadMemories, workflowBase.startWorkflowRun]);

  const runAgentAndReload = useCallback(async () => {
    const run = await agentBase.runAgent();
    if (run) {
      void workflowBase.reloadWorkflowLibrary();
      void memories.reloadMemories();
      void meetings.reloadMeetings();
    }
    return run;
  }, [agentBase.runAgent, meetings.reloadMeetings, memories.reloadMemories, workflowBase.reloadWorkflowLibrary]);

  const openDetail = useCallback((meetingId: string) => {
    meetings.setSelectedMeetingId(meetingId);
    setIsDetailEditing(false);
    setIsDetailOpen(true);
  }, [meetings.setSelectedMeetingId]);

  const openEdit = useCallback((meetingId: string) => {
    meetings.setSelectedMeetingId(meetingId);
    setIsDetailEditing(true);
    setIsDetailOpen(true);
  }, [meetings.setSelectedMeetingId]);

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setIsDetailEditing(false);
  }, []);

  const openNodeAgent = useCallback((templateId: string, nodeId: string) => {
    setPendingNodeAgentKey(`${templateId}-${nodeId}`);
    setWorkbenchView("apps");
  }, []);

  const clearPendingNodeAgent = useCallback(() => {
    setPendingNodeAgentKey(null);
  }, []);

  const submitCreate = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    const success = await meetings.createMeeting(event);
    if (success) {
      setIsCreateOpen(false);
    }
  }, [meetings.createMeeting]);

  const deleteSelectedMeeting = useCallback(async () => {
    const success = await meetings.deleteMeeting();
    if (success) {
      closeDetail();
    }
    return success;
  }, [closeDetail, meetings.deleteMeeting]);

  const workflow = useMemo(
    () => ({
      ...workflowBase,
      advanceRunAndReloadMemories,
      retryRunAndReloadMemories,
      startRunForSelectedMeeting
    }),
    [advanceRunAndReloadMemories, retryRunAndReloadMemories, startRunForSelectedMeeting, workflowBase]
  );

  const agent = useMemo(
    () => ({
      ...agentBase,
      runAgentAndReload
    }),
    [agentBase, runAgentAndReload]
  );

  const derived = useMemo(() => {
    const todayMeetingCount = meetings.filteredMeetings.filter((meeting) => isToday(meeting.startAt)).length;
    const modelRuntimeLabel = aiSettings.settings.keySource === "user"
      ? "用户模型 Key"
      : aiSettings.settings.keySource === "environment"
        ? "环境模型 Key"
        : "Mock 模型";

    return { todayMeetingCount, modelRuntimeLabel };
  }, [aiSettings.settings.keySource, meetings.filteredMeetings]);

  const modals = useMemo(
    () => ({
      isCreateOpen,
      openCreate: () => setIsCreateOpen(true),
      closeCreate: () => setIsCreateOpen(false),
      isDetailOpen,
      isDetailEditing,
      setDetailEditing: setIsDetailEditing,
      openDetail,
      openEdit,
      closeDetail,
      submitCreate,
      deleteSelectedMeeting
    }),
    [closeDetail, deleteSelectedMeeting, isCreateOpen, isDetailEditing, isDetailOpen, openDetail, openEdit, submitCreate]
  );

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      workbenchView,
      setWorkbenchView,
      pendingNodeAgentKey,
      openNodeAgent,
      clearPendingNodeAgent,
      meetings,
      workflow,
      googleCalendar,
      feishuCalendar,
      aiSettings,
      memories,
      agent,
      modals,
      derived
    }),
    [agent, aiSettings, clearPendingNodeAgent, derived, feishuCalendar, googleCalendar, meetings, memories, modals, openNodeAgent, pendingNodeAgentKey, workflow, workbenchView]
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench() {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error("useWorkbench must be used within a WorkbenchProvider");
  }
  return context;
}

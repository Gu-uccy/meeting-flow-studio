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
import type { MeetingAgentRun, MeetingAgentAction, ProductWorkflowRun } from "@meeting-flow/shared";
import type { RunsConsoleFilters } from "../lib/runsConsoleUtils";

export type WorkbenchView = "workspace" | "apps" | "account" | "runs";

export type RunsConsolePreset = Partial<Pick<RunsConsoleFilters, "status" | "templateId" | "meetingId" | "search">>;

export type CanvasFocusRun = {
  runId: string;
  templateId: string;
  meetingId: string;
};

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
  runsConsolePreset: RunsConsolePreset | null;
  openRunsConsole: (preset?: RunsConsolePreset) => void;
  clearRunsConsolePreset: () => void;
  canvasFocusRun: CanvasFocusRun | null;
  focusRunInCanvas: (run: ProductWorkflowRun) => void;
  clearCanvasFocusRun: () => void;
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
    actionFeedback: string;
    executeAgentAction: (action: MeetingAgentAction) => Promise<boolean>;
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
  const [runsConsolePreset, setRunsConsolePreset] = useState<RunsConsolePreset | null>(null);
  const [canvasFocusRun, setCanvasFocusRun] = useState<CanvasFocusRun | null>(null);
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
  const [agentActionFeedback, setAgentActionFeedback] = useState("");

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

  const executeAgentAction = useCallback(async (action: MeetingAgentAction) => {
    if (!meetings.selectedMeeting || action.kind === "none") {
      return false;
    }

    setAgentActionFeedback("");

    try {
      switch (action.kind) {
        case "start_workflow": {
          const templateId = action.payload.templateId;
          if (!templateId) {
            throw new Error("缺少工作流模板 ID");
          }
          const run = await startRunForSelectedMeeting(templateId);
          if (!run) {
            throw new Error("工作流启动失败");
          }
          await workflowBase.reloadWorkflowLibrary();
          setAgentActionFeedback(`已执行：${action.title}`);
          return true;
        }
        case "advance_blocker": {
          const runId = action.payload.runId;
          if (!runId) {
            throw new Error("缺少运行 ID");
          }
          const run = await advanceRunAndReloadMemories(runId, "Agent 推荐：已补充阻塞处理说明");
          if (!run) {
            throw new Error("阻塞处理失败");
          }
          await workflowBase.reloadWorkflowLibrary();
          setAgentActionFeedback(`已执行：${action.title}`);
          return true;
        }
        case "sync_calendar": {
          const meetingId = action.payload.meetingId || meetings.selectedMeeting.id;
          if (googleCalendar.isConfigured && googleCalendar.isConnected) {
            await googleCalendar.syncMeeting(meetingId);
          } else if (feishuCalendar.isConfigured && feishuCalendar.isConnected) {
            await feishuCalendar.syncMeeting(meetingId);
          } else {
            await googleCalendar.syncMeeting(meetingId);
          }
          setAgentActionFeedback(`已执行：${action.title}`);
          return true;
        }
        case "prepare_agenda":
        case "update_meeting":
          openEdit(meetings.selectedMeeting.id);
          setAgentActionFeedback(`已打开会议编辑：${action.title}`);
          return true;
        case "review_memory":
          openDetail(meetings.selectedMeeting.id);
          setAgentActionFeedback(`已打开会议详情：${action.title}`);
          return true;
        default:
          return false;
      }
    } catch (error) {
      setAgentActionFeedback(error instanceof Error ? error.message : "Agent 动作执行失败");
      return false;
    }
  }, [
    advanceRunAndReloadMemories,
    feishuCalendar,
    googleCalendar,
    meetings.selectedMeeting,
    openDetail,
    openEdit,
    startRunForSelectedMeeting,
    workflowBase
  ]);

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

  const openRunsConsole = useCallback((preset?: RunsConsolePreset) => {
    setRunsConsolePreset(preset ?? null);
    setWorkbenchView("runs");
  }, []);

  const clearRunsConsolePreset = useCallback(() => {
    setRunsConsolePreset(null);
  }, []);

  const focusRunInCanvas = useCallback((run: ProductWorkflowRun) => {
    meetings.setSelectedMeetingId(run.meetingId);
    setCanvasFocusRun({
      runId: run.id,
      templateId: run.templateId,
      meetingId: run.meetingId
    });
    setWorkbenchView("workspace");
  }, [meetings.setSelectedMeetingId]);

  const clearCanvasFocusRun = useCallback(() => {
    setCanvasFocusRun(null);
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
      actionFeedback: agentActionFeedback,
      executeAgentAction,
      runAgentAndReload
    }),
    [agentActionFeedback, agentBase, executeAgentAction, runAgentAndReload]
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
      runsConsolePreset,
      openRunsConsole,
      clearRunsConsolePreset,
      canvasFocusRun,
      focusRunInCanvas,
      clearCanvasFocusRun,
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
    [agent, aiSettings, canvasFocusRun, clearCanvasFocusRun, clearPendingNodeAgent, clearRunsConsolePreset, derived, feishuCalendar, focusRunInCanvas, googleCalendar, meetings, memories, modals, openNodeAgent, openRunsConsole, pendingNodeAgentKey, runsConsolePreset, workflow, workbenchView]
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

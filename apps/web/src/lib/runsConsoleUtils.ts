import type {
  MeetingRecord,
  ProductWorkflowRun,
  ProductWorkflowRunStatus,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";

export type RunsConsoleFilters = {
  status: "all" | ProductWorkflowRunStatus;
  templateId: string;
  meetingId: string;
  search: string;
  ownerScope: "all" | "mine";
};

export type RunsConsoleStats = {
  total: number;
  running: number;
  blocked: number;
  failed: number;
  completed: number;
  queued: number;
};

export function buildRunsConsoleStats(runs: ProductWorkflowRun[]): RunsConsoleStats {
  return runs.reduce<RunsConsoleStats>(
    (stats, run) => {
      stats.total += 1;
      stats[run.status] += 1;
      return stats;
    },
    { total: 0, running: 0, blocked: 0, failed: 0, completed: 0, queued: 0 }
  );
}

export function filterRunsConsole(
  runs: ProductWorkflowRun[],
  filters: RunsConsoleFilters,
  options?: {
    meetings?: MeetingRecord[];
    ownerUserId?: string;
  }
) {
  const search = filters.search.trim().toLowerCase();
  const ownedMeetingIds = filters.ownerScope === "mine" && options?.ownerUserId
    ? new Set(
      (options.meetings ?? [])
        .filter((meeting) => meeting.ownerUserId === options.ownerUserId)
        .map((meeting) => meeting.id)
    )
    : null;

  return runs
    .filter((run) => (filters.status === "all" ? true : run.status === filters.status))
    .filter((run) => (filters.templateId ? run.templateId === filters.templateId : true))
    .filter((run) => (filters.meetingId ? run.meetingId === filters.meetingId : true))
    .filter((run) => (ownedMeetingIds ? ownedMeetingIds.has(run.meetingId) : true))
    .filter((run) => {
      if (!search) return true;
      return run.name.toLowerCase().includes(search) || run.id.toLowerCase().includes(search);
    })
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export function resolveRunContext(
  run: ProductWorkflowRun,
  templates: ProductWorkflowTemplate[],
  meetings: MeetingRecord[]
) {
  return {
    template: templates.find((item) => item.id === run.templateId) ?? null,
    meeting: meetings.find((item) => item.id === run.meetingId) ?? null
  };
}

export function getBlockedNodeRun(run: ProductWorkflowRun) {
  return run.nodeRuns.find((nodeRun) => nodeRun.status === "blocked" || nodeRun.status === "failed");
}

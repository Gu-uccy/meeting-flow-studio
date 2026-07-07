import type { MeetingRecord, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import {
  notifyWorkflowUpdate,
  persistWorkflowMeetingWriteback,
  persistWorkflowMemories,
  sortRunsByStartedAtDesc
} from "../lib/context.js";
import { saveWorkflowRuns } from "../workflowStore.js";
import {
  buildInitialWorkflowRun,
  executeWorkflowRun,
  prepareAdvanceWorkflowRun,
  resumeWorkflowRun,
  type WorkflowExecutionOptions
} from "./executor.js";

const cancelledRunIds = new Set<string>();
const activeRunIds = new Set<string>();

export function createWorkflowRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function markWorkflowRunCancelled(runId: string) {
  cancelledRunIds.add(runId);
}

export function isWorkflowRunCancelled(runId: string) {
  return cancelledRunIds.has(runId);
}

export function isWorkflowRunActive(runId: string) {
  return activeRunIds.has(runId);
}

function clearWorkflowRunState(runId: string) {
  cancelledRunIds.delete(runId);
  activeRunIds.delete(runId);
}

async function persistRunProgress(ctx: AppContext, run: ProductWorkflowRun) {
  ctx.workflowRuns = ctx.workflowRuns.map((item) => (item.id === run.id ? run : item)).sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(ctx.workflowRuns);
  notifyWorkflowUpdate(ctx, run);
}

async function finalizeWorkflowRun(ctx: AppContext, meeting: MeetingRecord, run: ProductWorkflowRun) {
  ctx.workflowRuns = ctx.workflowRuns.map((item) => (item.id === run.id ? run : item)).sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(ctx.workflowRuns);
  await persistWorkflowMeetingWriteback(meeting, run, ctx);
  await persistWorkflowMemories(meeting, run, ctx);
  notifyWorkflowUpdate(ctx, run);
}

export async function enqueueWorkflowRunJob(
  ctx: AppContext,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  options?: WorkflowExecutionOptions
) {
  const runId = createWorkflowRunId();
  const initialRun = buildInitialWorkflowRun(meeting, template, runId);

  ctx.workflowRuns = [initialRun, ...ctx.workflowRuns].sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(ctx.workflowRuns);
  notifyWorkflowUpdate(ctx, initialRun);

  void runWorkflowJob(ctx, meeting, template, runId, options);
  return initialRun;
}

export async function enqueueWorkflowAdvanceJob(
  ctx: AppContext,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  run: ProductWorkflowRun,
  resolutionNote: string,
  options?: WorkflowExecutionOptions
) {
  const preparedRun = prepareAdvanceWorkflowRun(run, meeting, template, resolutionNote);

  if (preparedRun.status !== "running") {
    ctx.workflowRuns = ctx.workflowRuns.map((item) => (item.id === run.id ? preparedRun : item)).sort(sortRunsByStartedAtDesc);
    await saveWorkflowRuns(ctx.workflowRuns);
    await persistWorkflowMeetingWriteback(meeting, preparedRun, ctx);
    await persistWorkflowMemories(meeting, preparedRun, ctx);
    notifyWorkflowUpdate(ctx, preparedRun);
    return preparedRun;
  }

  const advancingRun: ProductWorkflowRun = {
    ...preparedRun,
    logs: [
      ...preparedRun.logs,
      {
        id: `log-${Date.now()}-advance`,
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        level: "info",
        message: "阻塞已处理，流程继续在后台运行"
      }
    ]
  };

  ctx.workflowRuns = ctx.workflowRuns.map((item) => (item.id === run.id ? advancingRun : item)).sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(ctx.workflowRuns);
  notifyWorkflowUpdate(ctx, advancingRun);

  void runWorkflowJob(ctx, meeting, template, run.id, options, advancingRun);
  return advancingRun;
}

export async function waitForWorkflowRunCompletion(
  ctx: AppContext,
  runId: string,
  timeoutMs = 8000,
  pollMs = 80
): Promise<ProductWorkflowRun | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const run = ctx.workflowRuns.find((item) => item.id === runId);
    if (run && run.status !== "running") {
      return run;
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return ctx.workflowRuns.find((item) => item.id === runId) ?? null;
}

export async function enqueueWorkflowResumeJob(
  ctx: AppContext,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  run: ProductWorkflowRun,
  options?: WorkflowExecutionOptions
) {
  const resumedRun: ProductWorkflowRun = {
    ...run,
    status: "running",
    endedAt: undefined,
    logs: [
      ...run.logs,
      {
        id: `log-${Date.now()}-retry`,
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        level: "info",
        message: "从失败节点断点续跑"
      }
    ]
  };

  ctx.workflowRuns = ctx.workflowRuns.map((item) => (item.id === run.id ? resumedRun : item)).sort(sortRunsByStartedAtDesc);
  await saveWorkflowRuns(ctx.workflowRuns);
  notifyWorkflowUpdate(ctx, resumedRun);

  void runWorkflowJob(ctx, meeting, template, run.id, options, resumedRun);
  return resumedRun;
}

async function runWorkflowJob(
  ctx: AppContext,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  runId: string,
  options?: WorkflowExecutionOptions,
  resumeFrom?: ProductWorkflowRun
) {
  activeRunIds.add(runId);

  try {
    const executor = resumeFrom ? resumeWorkflowRun : executeWorkflowRun;
    const run = await executor(meeting, template, undefined, options, {
      runId,
      resumeFrom,
      isCancelled: () => isWorkflowRunCancelled(runId),
        onProgress: async (progressRun) => {
          await persistRunProgress(ctx, progressRun);
        }
    });

    await finalizeWorkflowRun(ctx, meeting, run);
  } catch (error) {
    const failedRun = ctx.workflowRuns.find((item) => item.id === runId);
    if (failedRun) {
      const message = error instanceof Error ? error.message : "流程执行失败";
      const erroredRun: ProductWorkflowRun = {
        ...failedRun,
        status: "failed",
        endedAt: new Date().toISOString(),
        logs: [
          ...failedRun.logs,
          {
            id: `log-${Date.now()}-fatal`,
            time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            level: "error",
            message
          }
        ]
      };
      await finalizeWorkflowRun(ctx, meeting, erroredRun);
    }
  } finally {
    clearWorkflowRunState(runId);
  }
}

export async function executeWorkflowRunSync(
  ctx: AppContext,
  meeting: MeetingRecord,
  template: ProductWorkflowTemplate,
  options?: WorkflowExecutionOptions
) {
  const run = await executeWorkflowRun(meeting, template, undefined, options);
  ctx.workflowRuns = [run, ...ctx.workflowRuns].sort(sortRunsByStartedAtDesc);
  await finalizeWorkflowRun(ctx, meeting, run);
  return run;
}

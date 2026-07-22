import type { MeetingRecord, ProductWorkflowRun } from "@meeting-flow/shared";
import type { AppContext } from "../lib/context.js";
import { buildWorkflowExecutionOptions } from "../lib/executionOptions.js";
import { enqueueWorkflowAdvanceJob } from "./workflowJobRunner.js";

function isRecordingBlockedNode(run: ProductWorkflowRun) {
  return run.nodeRuns.some((nodeRun) => {
    if (nodeRun.status !== "blocked") {
      return false;
    }
    const message = nodeRun.errorMessage ?? "";
    return /录音|录制|recording/i.test(message) || nodeRun.nodeId === "minutes";
  });
}

/**
 * When Feishu recording becomes ready, resume runs blocked on the minutes node.
 */
export async function tryAdvanceRunsBlockedOnRecording(
  ctx: AppContext,
  meeting: MeetingRecord,
  actorUserId: string
) {
  if (meeting.externalMeeting?.recordingStatus !== "ready") {
    return [] as ProductWorkflowRun[];
  }

  const candidates = ctx.workflowRuns.filter(
    (run) => run.meetingId === meeting.id && run.status === "blocked" && isRecordingBlockedNode(run)
  );

  if (candidates.length === 0) {
    return [];
  }

  const options = await buildWorkflowExecutionOptions(actorUserId);
  const advanced: ProductWorkflowRun[] = [];

  for (const run of candidates) {
    const template = ctx.workflowTemplates.find((item) => item.id === run.templateId);
    if (!template) {
      continue;
    }

    const next = await enqueueWorkflowAdvanceJob(
      ctx,
      meeting,
      template,
      run,
      "飞书录音已就绪，自动继续纪要节点",
      options
    );
    advanced.push(next);
  }

  return advanced;
}

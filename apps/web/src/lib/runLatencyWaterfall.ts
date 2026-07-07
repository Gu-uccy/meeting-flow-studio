import type { ProductNodeRun, ProductNodeRunStatus, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";

export type RunLatencySegment = {
  durationMs: number;
  durationLabel: string;
  hasTiming: boolean;
  label: string;
  nodeId: string;
  offsetMs: number;
  offsetPercent: number;
  status: ProductNodeRunStatus;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  widthPercent: number;
};

export type RunLatencyWaterfallModel = {
  hasTiming: boolean;
  segments: RunLatencySegment[];
  totalMs: number;
  totalLabel: string;
};

function formatDurationLabel(durationMs: number) {
  if (durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))}ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${Math.round(seconds)}s`;
}

function getNodeLabel(template: ProductWorkflowTemplate | null | undefined, nodeId: string) {
  return template?.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

function getNodeTokens(nodeRun: ProductNodeRun) {
  const input = Number(nodeRun.outputPayload?.inputTokens ?? 0);
  const output = Number(nodeRun.outputPayload?.outputTokens ?? 0);

  if (!Number.isFinite(input) && !Number.isFinite(output)) {
    return undefined;
  }

  const safeInput = Number.isFinite(input) ? input : 0;
  const safeOutput = Number.isFinite(output) ? output : 0;

  if (safeInput === 0 && safeOutput === 0) {
    return undefined;
  }

  return {
    input: safeInput,
    output: safeOutput,
    total: safeInput + safeOutput
  };
}

function resolveRunWindow(run: ProductWorkflowRun) {
  const runStartMs = new Date(run.startedAt).getTime();
  const timedEnds = run.nodeRuns
    .map((nodeRun) => (nodeRun.endedAt ? new Date(nodeRun.endedAt).getTime() : null))
    .filter((value): value is number => value !== null);
  const runEndMs = run.endedAt
    ? new Date(run.endedAt).getTime()
    : timedEnds.length > 0
      ? Math.max(...timedEnds)
      : runStartMs + Math.max(1, run.durationSeconds) * 1000;

  return {
    runStartMs,
    runEndMs,
    totalMs: Math.max(1, runEndMs - runStartMs)
  };
}

export function buildRunLatencyWaterfall(
  run: ProductWorkflowRun,
  template?: ProductWorkflowTemplate | null
): RunLatencyWaterfallModel {
  const { runStartMs, totalMs } = resolveRunWindow(run);

  const segments = run.nodeRuns.map((nodeRun) => {
    const label = getNodeLabel(template, nodeRun.nodeId);
    const tokens = getNodeTokens(nodeRun);

    if (!nodeRun.startedAt) {
      return {
        nodeId: nodeRun.nodeId,
        label,
        status: nodeRun.status,
        hasTiming: false,
        offsetMs: 0,
        durationMs: 0,
        offsetPercent: 0,
        widthPercent: 0,
        durationLabel: nodeRun.status === "pending" ? "未执行" : "—",
        tokens
      };
    }

    const startedMs = new Date(nodeRun.startedAt).getTime();
    const endedMs = nodeRun.endedAt
      ? new Date(nodeRun.endedAt).getTime()
      : startedMs + Math.max(1, Math.round(totalMs * 0.08));
    const offsetMs = Math.max(0, startedMs - runStartMs);
    const durationMs = Math.max(0, endedMs - startedMs);

    return {
      nodeId: nodeRun.nodeId,
      label,
      status: nodeRun.status,
      hasTiming: true,
      offsetMs,
      durationMs,
      offsetPercent: Math.min(100, (offsetMs / totalMs) * 100),
      widthPercent: Math.min(100 - (offsetMs / totalMs) * 100, Math.max(0.8, (durationMs / totalMs) * 100)),
      durationLabel: formatDurationLabel(durationMs),
      tokens
    };
  });

  const timedSegments = segments.filter((segment) => segment.hasTiming);
  const sortedSegments = [...segments].sort((left, right) => {
    if (left.hasTiming !== right.hasTiming) {
      return left.hasTiming ? -1 : 1;
    }

    if (left.offsetMs !== right.offsetMs) {
      return left.offsetMs - right.offsetMs;
    }

    return right.durationMs - left.durationMs;
  });

  return {
    hasTiming: timedSegments.length > 0,
    segments: sortedSegments,
    totalMs,
    totalLabel: formatDurationLabel(totalMs)
  };
}

export function getRunLatencyAxisMarks(totalMs: number) {
  const totalSeconds = totalMs / 1000;
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    label: formatDurationLabel(totalMs * ratio),
    percent: ratio * 100
  })).filter((_mark, index, marks) => index === 0 || index === marks.length - 1 || totalSeconds >= 4);
}

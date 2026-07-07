import type { MeetingRecord, ProductWorkflowNode, ProductNodeRun } from "@meeting-flow/shared";

type RuntimePayload = Record<string, unknown>;

export type OutputMappingApplied = {
  path: string;
  source: string;
  value: unknown;
};

export function buildMeetingPayload(meeting: MeetingRecord): Record<string, unknown> {
  return {
    attendeeCount: meeting.attendeeCount,
    meetingGoal: meeting.meetingGoal,
    meetingId: meeting.id,
    participants: meeting.participants.map((participant) => participant.name),
    priority: meeting.priority,
    title: meeting.title,
    type: meeting.type
  };
}

export function createWorkflowRuntimeStore(meeting: MeetingRecord): Record<string, unknown> {
  return {
    meeting: buildMeetingPayload(meeting),
    node: {}
  };
}

export function getPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, source);
}

export function setPathValue(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]!;
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]!] = value;
}

function deepMergeRecords(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    const existing = merged[key];
    if (existing && typeof existing === "object" && !Array.isArray(existing) && value && typeof value === "object" && !Array.isArray(value)) {
      merged[key] = deepMergeRecords(existing as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

export function buildWorkflowRuntimeContext(
  meeting: MeetingRecord,
  nodeResults: Map<string, ProductNodeRun>,
  runtimeStore?: Record<string, unknown>
): Record<string, unknown> {
  const fromRuns = {
    meeting: buildMeetingPayload(meeting),
    node: Object.fromEntries([...nodeResults.entries()].map(([nodeId, run]) => [nodeId, run.outputPayload ?? {}]))
  };

  return runtimeStore ? deepMergeRecords(fromRuns, runtimeStore) : fromRuns;
}

function resolveOutputSourceValue(outputPayload: RuntimePayload, sourceKey: string): unknown {
  const structuredOutput = outputPayload.structuredOutput;
  if (structuredOutput && typeof structuredOutput === "object" && !Array.isArray(structuredOutput)) {
    const structured = structuredOutput as Record<string, unknown>;
    if (sourceKey in structured) {
      return structured[sourceKey];
    }
  }

  return outputPayload[sourceKey];
}

export function applyNodeOutputMapping(
  node: ProductWorkflowNode,
  outputPayload: RuntimePayload,
  runtimeStore: Record<string, unknown>
): { applied: OutputMappingApplied[]; outputPayload: RuntimePayload } {
  const mapping = node.executor?.outputMapping ?? {};
  const applied: OutputMappingApplied[] = [];

  for (const [sourceKey, targetPath] of Object.entries(mapping)) {
    const value = resolveOutputSourceValue(outputPayload, sourceKey);
    if (value === undefined) {
      continue;
    }

    setPathValue(runtimeStore, targetPath.trim(), value);
    applied.push({ path: targetPath.trim(), source: sourceKey, value });
  }

  const nodeBucket = ((runtimeStore.node as Record<string, Record<string, unknown>> | undefined) ?? {});
  runtimeStore.node = {
    ...nodeBucket,
    [node.id]: {
      ...(nodeBucket[node.id] ?? {}),
      ...outputPayload
    }
  };

  return {
    applied,
    outputPayload: {
      ...outputPayload,
      outputMappingApplied: applied
    }
  };
}

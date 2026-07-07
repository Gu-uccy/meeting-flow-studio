import type { AiApplicationInputField, AiApplicationPromptConfig, MeetingRecord, ProductWorkflowNode } from "@meeting-flow/shared";

export type PromptRetrievalContext = {
  citations?: Array<{
    content: string;
    id: string;
    kind: string;
    similarity?: number;
    updatedAt?: string;
  }>;
  contextPack?: Array<{
    content: string;
    id: string;
    kind: string;
    similarity?: number;
    source: string;
  }>;
  embeddingModel?: string;
  retrievalMode?: string;
  topSimilarity?: number;
};

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current == null || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, source);
}

function stringifyPromptValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

export function formatContextPackText(contextPack: PromptRetrievalContext["contextPack"]) {
  if (!contextPack?.length) {
    return "";
  }

  return contextPack
    .map((item, index) => {
      const similarity = item.similarity != null ? ` · 相似度 ${(item.similarity * 100).toFixed(1)}%` : "";
      return `[${index + 1}] ${item.kind}/${item.source}${similarity}\n${item.content}`;
    })
    .join("\n\n");
}

export function buildRetrievalQuery(meeting: MeetingRecord | null) {
  if (!meeting) {
    return "";
  }

  return [meeting.meetingGoal, meeting.title, meeting.notes.trim(), meeting.agendaItems.map((item) => item.title).join(" ")]
    .filter(Boolean)
    .join("\n");
}

export function buildPromptPreviewContext(
  node: ProductWorkflowNode,
  meeting: MeetingRecord | null,
  inputValues: Record<string, string>,
  retrieval?: PromptRetrievalContext | null
) {
  const contextPack = retrieval?.contextPack ?? [];
  const citations = retrieval?.citations ?? [];
  const contextPackText = formatContextPackText(contextPack);
  const inputPayload: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(inputValues).map(([key, value]) => [key, value])),
    ...(retrieval
      ? {
          citations,
          contextPack,
          contextPackText
        }
      : {})
  };

  return {
    citations,
    contextPack,
    input: inputPayload,
    inputs: inputPayload,
    meeting: meeting
      ? {
          attendeeCount: meeting.attendeeCount,
          meetingGoal: meeting.meetingGoal,
          meetingId: meeting.id,
          participants: meeting.participants.map((participant) => participant.name),
          priority: meeting.priority,
          title: meeting.title,
          type: meeting.type
        }
      : {},
    node: {
      id: node.id,
      kind: node.kind,
      title: node.title
    },
    retrieval: {
      contextPackText,
      embeddingModel: retrieval?.embeddingModel ?? "",
      mode: retrieval?.retrievalMode ?? "",
      topSimilarity: retrieval?.topSimilarity ?? 0
    }
  };
}

export function renderPromptTemplate(template: string, context: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = getPathValue(context, path) ?? (context.input as Record<string, unknown> | undefined)?.[path];
    return stringifyPromptValue(value);
  });
}

export function previewNodeAgentPrompts(
  config: AiApplicationPromptConfig,
  node: ProductWorkflowNode,
  meeting: MeetingRecord | null,
  inputValues: Record<string, string>,
  retrieval?: PromptRetrievalContext | null
) {
  const context = buildPromptPreviewContext(node, meeting, inputValues, retrieval);
  return {
    systemPrompt: renderPromptTemplate(config.systemPrompt, context),
    userPrompt: renderPromptTemplate(config.userPrompt, context)
  };
}

export function getDefaultPromptInputValues(
  fields: AiApplicationInputField[],
  meeting: MeetingRecord | null
) {
  return Object.fromEntries(
    fields.map((field) => {
      if (!meeting) return [field.key, field.defaultValue];
      if (field.key === "meetingId") return [field.key, meeting.id];
      if (field.key === "meetingGoal") return [field.key, meeting.meetingGoal];
      if (field.key === "priority") return [field.key, meeting.priority];
      if (field.key === "participants") {
        return [field.key, JSON.stringify(meeting.participants.map((participant) => participant.name))];
      }
      const value = meeting[field.key as keyof MeetingRecord];
      return [
        field.key,
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : field.defaultValue
      ];
    })
  );
}

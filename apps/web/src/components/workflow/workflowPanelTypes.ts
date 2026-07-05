import type { MeetingNodeKind } from "@meeting-flow/shared";

export type WorkflowNodeData = {
  title: string;
  summary: string;
  kind: MeetingNodeKind;
  state: "done" | "running" | "waiting" | "blocked" | "optional";
  owner: string;
};

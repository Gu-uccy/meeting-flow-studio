import { z } from "zod";

export const meetingNodeKinds = [
  "trigger",
  "ai",
  "decision",
  "action",
  "knowledge"
] as const;

export const meetingNodeKindSchema = z.enum(meetingNodeKinds);

export type MeetingNodeKind = z.infer<typeof meetingNodeKindSchema>;

export const workflowStepSchema = z.object({
  id: z.string(),
  kind: meetingNodeKindSchema,
  title: z.string(),
  summary: z.string(),
  x: z.number(),
  y: z.number()
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowConnectionSchema = z.object({
  source: z.string(),
  target: z.string()
});

export type WorkflowConnection = z.infer<typeof workflowConnectionSchema>;

export const workflowBlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(workflowStepSchema),
  connections: z.array(workflowConnectionSchema)
});

export type WorkflowBlueprint = z.infer<typeof workflowBlueprintSchema>;

export const meetingIntakeSchema = z.object({
  title: z.string().min(3),
  host: z.string().min(2),
  attendeeCount: z.number().int().positive(),
  meetingGoal: z.string().min(10),
  channel: z.enum(["zoom", "teams", "meet"])
});

export type MeetingIntake = z.infer<typeof meetingIntakeSchema>;

export const meetingNodeCatalog: Array<{
  kind: MeetingNodeKind;
  title: string;
  summary: string;
}> = [
  {
    kind: "trigger",
    title: "Meeting Requested",
    summary: "Capture the organizer intent and normalize the inbound request."
  },
  {
    kind: "ai",
    title: "AI Agenda Composer",
    summary: "Draft an agenda, risks, and recommended participants."
  },
  {
    kind: "knowledge",
    title: "Context Lookup",
    summary: "Pull CRM notes, prior meeting summaries, and project updates."
  },
  {
    kind: "decision",
    title: "Policy Gate",
    summary: "Branch based on urgency, attendee count, and approval rules."
  },
  {
    kind: "action",
    title: "Send Follow-up",
    summary: "Publish invites, notes, and next-step tasks to downstream tools."
  }
];

export const defaultWorkflowBlueprint: WorkflowBlueprint = {
  id: "meeting-orchestrator",
  name: "Intelligent Meeting Orchestrator",
  description:
    "A Zapier-like automation canvas for intake, preparation, facilitation, and post-meeting execution.",
  steps: [
    {
      id: "intake",
      kind: "trigger",
      title: "Intake Trigger",
      summary: "Receive a new meeting request from product, sales, or ops.",
      x: 120,
      y: 140
    },
    {
      id: "agenda",
      kind: "ai",
      title: "Generate Agenda",
      summary: "Turn the goal into an agenda, talking points, and success criteria.",
      x: 380,
      y: 140
    },
    {
      id: "context",
      kind: "knowledge",
      title: "Fetch Context",
      summary: "Collect prior notes, tasks, customer context, and blockers.",
      x: 640,
      y: 140
    },
    {
      id: "policy",
      kind: "decision",
      title: "Compliance Review",
      summary: "Check attendee threshold, confidentiality, and approval rules.",
      x: 900,
      y: 140
    },
    {
      id: "dispatch",
      kind: "action",
      title: "Dispatch Outcomes",
      summary: "Send invites, create follow-up tasks, and notify stakeholders.",
      x: 1160,
      y: 140
    }
  ],
  connections: [
    { source: "intake", target: "agenda" },
    { source: "agenda", target: "context" },
    { source: "context", target: "policy" },
    { source: "policy", target: "dispatch" }
  ]
};
import type { WorkbenchView } from "../contexts/WorkbenchContext";

export const WORKBENCH_VIEWS: WorkbenchView[] = [
  "workspace",
  "meeting",
  "chat",
  "knowledge",
  "memories",
  "meeting-agent",
  "config",
  "schedules",
  "runs",
  "apps",
  "account"
];

const MEETING_SCOPED_VIEWS = new Set<WorkbenchView>([
  "workspace",
  "meeting",
  "chat",
  "knowledge",
  "memories",
  "meeting-agent",
  "config",
  "schedules"
]);

export type WorkbenchRoute = {
  view: WorkbenchView;
  meetingId: string | null;
  nodeAgentKey: string | null;
};

function isWorkbenchView(value: string): value is WorkbenchView {
  return WORKBENCH_VIEWS.includes(value as WorkbenchView);
}

export function isMeetingScopedView(view: WorkbenchView) {
  return MEETING_SCOPED_VIEWS.has(view);
}

export function buildWorkbenchPath(
  view: WorkbenchView,
  meetingId: string | null = null,
  nodeAgentKey: string | null = null
) {
  if (view === "apps" && nodeAgentKey) {
    return `/app/apps/${encodeURIComponent(nodeAgentKey)}`;
  }

  if (isMeetingScopedView(view) && meetingId) {
    return `/app/${view}/${encodeURIComponent(meetingId)}`;
  }

  return `/app/${view}`;
}

export function parseWorkbenchPath(pathname: string): WorkbenchRoute | null {
  const match = pathname.match(/^\/app\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) {
    return null;
  }

  const rawViewSegment = decodeURIComponent(match[1] ?? "");
  // Legacy bookmark: /app/calendar → /app/config
  const viewSegment = rawViewSegment === "calendar" ? "config" : rawViewSegment;
  if (!isWorkbenchView(viewSegment)) {
    return null;
  }

  const rest = match[2] ? decodeURIComponent(match[2]) : null;

  if (viewSegment === "apps") {
    return { view: "apps", meetingId: null, nodeAgentKey: rest };
  }

  if (isMeetingScopedView(viewSegment)) {
    return { view: viewSegment, meetingId: rest, nodeAgentKey: null };
  }

  return { view: viewSegment, meetingId: null, nodeAgentKey: null };
}

export function replaceWorkbenchUrl(route: WorkbenchRoute) {
  const nextPath = buildWorkbenchPath(route.view, route.meetingId, route.nodeAgentKey);
  if (window.location.pathname === nextPath) {
    return;
  }

  window.history.replaceState(null, "", nextPath);
}

export function pushWorkbenchUrl(route: WorkbenchRoute) {
  const nextPath = buildWorkbenchPath(route.view, route.meetingId, route.nodeAgentKey);
  if (window.location.pathname === nextPath) {
    return;
  }

  window.history.pushState(null, "", nextPath);
}

import type { ReactNode } from "react";

type MeetingWorkspaceLayoutProps = {
  children: ReactNode;
  hint?: string | null;
  id?: string;
};

export function MeetingWorkspaceLayout({
  children,
  hint,
  id
}: MeetingWorkspaceLayoutProps) {
  return (
    <section className="meeting-workspace" data-testid="meeting-workspace" id={id}>
      {hint ? <p className="meeting-workspace__hint">{hint}</p> : null}
      <div className="meeting-workspace__frame">
        <div className="meeting-workspace__body">{children}</div>
      </div>
    </section>
  );
}

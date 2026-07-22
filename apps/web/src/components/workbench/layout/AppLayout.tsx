import type { ReactNode } from "react";
import type { WorkbenchView } from "../../../contexts/WorkbenchContext";
import { isFullBleedWorkbenchView } from "./viewMeta";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MeetingConnectionStrip } from "./MeetingConnectionStrip";

type AppLayoutProps = {
  children: ReactNode;
  headerActions?: ReactNode;
  onLogout: () => void;
  userName?: string;
  view: WorkbenchView;
};

export function AppLayout({ children, headerActions, onLogout, view }: AppLayoutProps) {
  const isFillView = isFullBleedWorkbenchView(view);

  return (
    <div className={`workbench-app${isFillView ? " workbench-app--fill" : ""}`} data-testid="workbench-app">
      <AppSidebar onLogout={onLogout} />
      <div className="workbench-app__frame">
        <AppHeader actions={headerActions} view={view} />
        <MeetingConnectionStrip />
        <main
          className={`workbench-app__content${isFillView ? " workbench-app__content--fill" : " workbench-app__content--scroll"}`}
          id="workbench"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

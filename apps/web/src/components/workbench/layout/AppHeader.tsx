import type { ReactNode } from "react";
import type { WorkbenchView } from "../../../contexts/WorkbenchContext";
import { workbenchViewMeta } from "./viewMeta";

type AppHeaderProps = {
  actions?: ReactNode;
  view: WorkbenchView;
};

export function AppHeader({ actions, view }: AppHeaderProps) {
  const meta = workbenchViewMeta[view];

  return (
    <header className="workbench-app__header">
      <div className="workbench-app__header-copy">
        <span className="workbench-app__header-kicker">{meta.kicker}</span>
        <div className="workbench-app__header-title-row">
          <h1 className="workbench-app__header-title">{meta.label}</h1>
          <p className="workbench-app__header-description">{meta.description}</p>
        </div>
      </div>
      {actions ? <div className="workbench-app__header-actions">{actions}</div> : null}
    </header>
  );
}

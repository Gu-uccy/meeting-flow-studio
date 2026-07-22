import type { ReactNode } from "react";

type NodeAgentStudioLayoutProps = {
  children: ReactNode;
  listPanel: ReactNode;
  toolbar?: ReactNode;
};

export function NodeAgentStudioLayout({ children, listPanel, toolbar }: NodeAgentStudioLayoutProps) {
  return (
    <section className="node-agent-studio">
      {toolbar ? <div className="node-agent-studio__toolbar">{toolbar}</div> : null}
      <div className="node-agent-studio__body">
        {listPanel}
        <div className="node-agent-studio__main">{children}</div>
      </div>
    </section>
  );
}

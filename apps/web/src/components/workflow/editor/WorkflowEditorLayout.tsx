import type { ReactNode } from "react";

type WorkflowEditorLayoutProps = {
  canvas: ReactNode;
  configPanel?: ReactNode;
  executionDock: ReactNode;
  palette?: ReactNode;
  readOnly?: boolean;
  toolbar?: ReactNode;
};

export function WorkflowEditorLayout({
  canvas,
  configPanel,
  executionDock,
  palette,
  readOnly = false,
  toolbar
}: WorkflowEditorLayoutProps) {
  return (
    <section className={`workflow-editor${readOnly ? " workflow-editor--readonly" : ""}`}>
      <div className="workflow-editor__main">
        {readOnly ? (
          <div className="workflow-editor__readonly-banner" role="status">
            只读模式 · 仅可查看流程与运行状态
          </div>
        ) : (
          toolbar
        )}

        <div className="workflow-editor__body">
          {readOnly ? null : palette}
          <div className="workflow-editor__canvas">{canvas}</div>
          {readOnly ? null : configPanel}
        </div>

        {executionDock}
      </div>
    </section>
  );
}

import { useEffect } from "react";
import type { MeetingRecord, ProductNodeRun, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { useWorkflowExecutionStore } from "../../../stores/workflowExecutionStore";
import { RunLatencyWaterfall } from "../RunLatencyWaterfall";
import { nodeRunLabels, runStatusLabels } from "../workflowPanelUtils";

type WorkflowExecutionDockProps = {
  blockedNodeRun?: ProductNodeRun;
  isWorkflowActionBusy: boolean;
  onAdvanceWorkflowRun: () => void;
  onCancelWorkflowRun: () => void;
  onOpenRunDetail: () => void;
  onRetryWorkflowRun: () => void;
  onStartWorkflowRun: () => void;
  readOnly?: boolean;
  resolutionNote: string;
  selectedFlowNodeId: string;
  selectedInputPayload: Array<{ key: string; value: string }>;
  selectedMeeting: MeetingRecord | null;
  selectedNode: { id: string; title: string } | null;
  selectedNodeRun?: ProductNodeRun;
  selectedOutputPayload: Array<{ key: string; value: string }>;
  selectedRun: ProductWorkflowRun | null;
  selectedTemplate: ProductWorkflowTemplate;
  setResolutionNote: (value: string) => void;
  setSelectedFlowNodeId: (nodeId: string) => void;
  workflowFeedback: string;
};

function TokenUsageBar({ run }: { run: ProductWorkflowRun }) {
  const usage = run.usage;
  if (!usage || usage.totalTokens <= 0) {
    return null;
  }

  const inputRatio = Math.round((usage.inputTokens / usage.totalTokens) * 100);
  const outputRatio = 100 - inputRatio;

  return (
    <div className="workflow-editor__dock-usage" aria-label="Token 用量">
      <div className="workflow-editor__dock-usage-head">
        <span>Token 用量</span>
        <strong>{usage.totalTokens.toLocaleString()}</strong>
      </div>
      <div className="workflow-editor__dock-usage-bar">
        <span className="workflow-editor__dock-usage-input" style={{ width: `${inputRatio}%` }} title={`输入 ${usage.inputTokens}`} />
        <span className="workflow-editor__dock-usage-output" style={{ width: `${outputRatio}%` }} title={`输出 ${usage.outputTokens}`} />
      </div>
      <small>
        输入 {usage.inputTokens.toLocaleString()} · 输出 {usage.outputTokens.toLocaleString()}
      </small>
    </div>
  );
}

export function WorkflowExecutionDock(props: WorkflowExecutionDockProps) {
  const {
    blockedNodeRun,
    isWorkflowActionBusy,
    onAdvanceWorkflowRun,
    onCancelWorkflowRun,
    onOpenRunDetail,
    onRetryWorkflowRun,
    onStartWorkflowRun,
    readOnly = false,
    resolutionNote,
    selectedFlowNodeId,
    selectedInputPayload,
    selectedMeeting,
    selectedNode,
    selectedNodeRun,
    selectedOutputPayload,
    selectedRun,
    selectedTemplate,
    setResolutionNote,
    setSelectedFlowNodeId,
    workflowFeedback
  } = props;

  const isOpen = useWorkflowExecutionStore((state) => state.isExecutionDockOpen);
  const setExecutionDockOpen = useWorkflowExecutionStore((state) => state.setExecutionDockOpen);
  const toggleExecutionDock = useWorkflowExecutionStore((state) => state.toggleExecutionDock);

  useEffect(() => {
    if (selectedRun) {
      setExecutionDockOpen(true);
    }
  }, [selectedRun?.id, setExecutionDockOpen]);

  useEffect(() => {
    if (selectedRun?.status === "running" || blockedNodeRun || selectedRun?.status === "failed") {
      setExecutionDockOpen(true);
    }
  }, [blockedNodeRun, selectedRun?.status, setExecutionDockOpen]);

  const runSummary = selectedRun
    ? `${runStatusLabels[selectedRun.status]} · ${selectedRun.durationSeconds}s${selectedRun.usage?.totalTokens ? ` · ${selectedRun.usage.totalTokens} tokens` : ""}`
    : "尚未运行";

  const dockStatusClass = selectedRun?.status === "running"
    ? " is-running"
    : blockedNodeRun
      ? " is-blocked"
      : selectedRun?.status === "failed"
        ? " is-failed"
        : "";

  return (
    <section className={`workflow-editor__dock${isOpen ? " is-open" : ""}${dockStatusClass}`} aria-label="运行面板">
      <div className="workflow-editor__dock-head">
        <button
          aria-expanded={isOpen}
          className="workflow-editor__dock-toggle"
          onClick={toggleExecutionDock}
          type="button"
        >
          <strong>运行</strong>
          <span>{runSummary}</span>
        </button>
        <div className="workflow-editor__dock-actions">
          {!readOnly ? (
            <>
              <button
                className="primary-button"
                disabled={!selectedMeeting || !selectedTemplate || isWorkflowActionBusy}
                onClick={() => void (blockedNodeRun ? onAdvanceWorkflowRun() : onStartWorkflowRun())}
                type="button"
              >
                {blockedNodeRun ? "继续" : "启动"}
              </button>
              {selectedRun?.status === "failed" && (
                <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onRetryWorkflowRun()} type="button">
                  断点续跑
                </button>
              )}
              {selectedRun?.status === "running" && (
                <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onCancelWorkflowRun()} type="button">
                  取消
                </button>
              )}
            </>
          ) : null}
          {selectedRun ? (
            <button className="ghost-button" onClick={onOpenRunDetail} type="button">
              详情
            </button>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <div className="workflow-editor__dock-body">
          {selectedRun ? <TokenUsageBar run={selectedRun} /> : null}

          {selectedNode ? (
            <div className="workflow-editor__dock-node" aria-label="当前节点">
              <strong>{selectedNode.title}</strong>
              <span className={`node-state-badge node-state-badge--${selectedNodeRun?.status ?? "pending"}`}>
                {selectedNodeRun ? nodeRunLabels[selectedNodeRun.status] : "未运行"}
              </span>
              {selectedNodeRun?.errorMessage ? <p className="workflow-side-panel__error">{selectedNodeRun.errorMessage}</p> : null}
              {(selectedInputPayload.length > 0 || selectedOutputPayload.length > 0) ? (
                <details className="workflow-side-panel__payload">
                  <summary>节点输入输出</summary>
                  <div>
                    {selectedInputPayload.map((item) => (
                      <code key={`in-${item.key}`}>{item.key}: {item.value}</code>
                    ))}
                    {selectedOutputPayload.map((item) => (
                      <code key={`out-${item.key}`}>{item.key}: {item.value}</code>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          <div className="workflow-editor__dock-logs scroll-area">
            {selectedRun ? <RunLatencyWaterfall run={selectedRun} template={selectedTemplate} variant="compact" /> : null}
            {selectedRun ? (
              selectedRun.logs.slice(-8).map((log) => (
                <button
                  className={`ide-run-log__row ide-run-log__row--${log.level}${log.nodeId === selectedFlowNodeId ? " is-active" : ""}`}
                  disabled={!log.nodeId}
                  key={log.id}
                  onClick={() => { if (log.nodeId) setSelectedFlowNodeId(log.nodeId); }}
                  type="button"
                >
                  <span>{log.time}</span>
                  <code>{log.message}</code>
                </button>
              ))
            ) : (
              <p className="memory-empty">{readOnly ? "当前会议尚未运行流程。" : "选择会议后点击「启动」开始第一次运行。"}</p>
            )}
          </div>

          {!readOnly && blockedNodeRun ? (
            <textarea
              aria-label="阻塞处理说明"
              className="workflow-side-panel__note"
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="记录阻塞处理说明，便于继续流程"
              value={resolutionNote}
            />
          ) : null}

          {workflowFeedback ? <p className="workflow-side-panel__feedback">{workflowFeedback}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

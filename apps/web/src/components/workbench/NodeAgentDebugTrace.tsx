import type { AiApplication, MeetingRecordWithPermissions, ProductNodeRun, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { formatDateTime } from "../../lib/format";
import { RunLatencyWaterfall } from "../workflow/RunLatencyWaterfall";

type NodeAgentDebugTraceProps = {
  app: AiApplication;
  meeting: MeetingRecordWithPermissions | null;
  run: ProductWorkflowRun;
  template: ProductWorkflowTemplate | null | undefined;
  inputs: Record<string, unknown>;
};

function stringifyTracePayload(payload?: ProductNodeRun["inputPayload"] | ProductNodeRun["outputPayload"]) {
  if (!payload || Object.keys(payload).length === 0) {
    return "{}";
  }

  return JSON.stringify(payload, null, 2);
}

function formatNodeRunDuration(nodeRun: ProductNodeRun) {
  if (!nodeRun.startedAt || !nodeRun.endedAt) {
    return "未结束";
  }

  const durationMs = new Date(nodeRun.endedAt).getTime() - new Date(nodeRun.startedAt).getTime();
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

function formatNodeRunWindow(nodeRun: ProductNodeRun) {
  if (!nodeRun.startedAt) {
    return "尚未开始";
  }

  return nodeRun.endedAt ? `${formatDateTime(nodeRun.startedAt)} - ${formatDateTime(nodeRun.endedAt)}` : formatDateTime(nodeRun.startedAt);
}

export function NodeAgentDebugTrace(props: NodeAgentDebugTraceProps) {
  const { app, inputs, meeting, run, template } = props;

  return (
    <section className="app-debug-console node-agent-debug-studio__trace" aria-label="调试 Trace">
      <div className="app-debug-console__header">
        <div>
          <h3>{app.name}</h3>
          <p>{meeting?.title ?? run.name} / {run.status} / {run.durationSeconds}s{run.usage?.totalTokens ? ` / ${run.usage.totalTokens} tokens` : ""}</p>
        </div>
        <span className={`run-status status-${run.status}`}>{run.status}</span>
      </div>
      <div className="app-debug-console__grid">
        <article className="app-debug-panel">
          <div className="app-debug-panel__title"><span>Input</span><strong>{app.entrypoint}</strong></div>
          <pre>{JSON.stringify(inputs, null, 2)}</pre>
        </article>
      </div>
      <div className="app-debug-console__grid app-debug-console__grid--wide">
        <article className="app-debug-panel app-debug-panel--wide">
          <RunLatencyWaterfall run={run} template={template} variant="full" />
        </article>
      </div>
      <div className="app-debug-console__grid app-debug-console__grid--wide">
        <article className="app-debug-panel">
          <div className="app-debug-panel__title"><span>Node Trace</span><strong>{template?.nodes.length ?? run.nodeRuns.length} nodes</strong></div>
          <div className="debug-node-list">
            {run.nodeRuns.map((nodeRun) => {
              const node = template?.nodes.find((entry) => entry.id === nodeRun.nodeId);
              const nodeLogs = run.logs.filter((log) => log.nodeId === nodeRun.nodeId);
              return (
                <article className="debug-node-row" key={nodeRun.nodeId}>
                  <div className="debug-node-row__header">
                    <div><span className={`node-state-badge node-state-badge--${nodeRun.status}`}>{nodeRun.status}</span><strong>{node?.title ?? nodeRun.nodeId}</strong></div>
                    <small>{formatNodeRunDuration(nodeRun)}</small>
                  </div>
                  <div className="debug-node-row__meta"><code>{nodeRun.nodeId}</code><span>{formatNodeRunWindow(nodeRun)}</span></div>
                  {typeof nodeRun.outputPayload?.inputTokens === "number" || typeof nodeRun.outputPayload?.outputTokens === "number" ? (
                    <div className="debug-node-row__usage">
                      <span>Token</span>
                      <code>
                        in {Number(nodeRun.outputPayload?.inputTokens ?? 0)} / out {Number(nodeRun.outputPayload?.outputTokens ?? 0)}
                        {typeof nodeRun.outputPayload?.responseFormat === "string" ? ` / ${nodeRun.outputPayload.responseFormat}` : ""}
                      </code>
                    </div>
                  ) : null}
                  {nodeRun.errorMessage ? <div className="debug-node-row__error"><span>Error</span><code>{nodeRun.errorMessage}</code></div> : null}
                  <div className="debug-trace-payloads">
                    <div><span>Input</span><pre>{stringifyTracePayload(nodeRun.inputPayload)}</pre></div>
                    <div><span>Output</span><pre>{stringifyTracePayload(nodeRun.outputPayload)}</pre></div>
                  </div>
                  {nodeLogs.length > 0 ? (
                    <div className="debug-node-row__logs">
                      {nodeLogs.map((log) => (
                        <code className={`debug-node-row__log debug-node-row__log--${log.level}`} key={log.id}>{log.time} / {log.message}</code>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </article>
        <article className="app-debug-panel">
          <div className="app-debug-panel__title"><span>Trace</span><strong>{run.logs.length} logs</strong></div>
          <div className="debug-log-list">
            {run.logs.map((log) => (
              <div className={`debug-log-row debug-log-row--${log.level}`} key={log.id}><span>{log.time}</span><code>{log.nodeId ? `${log.nodeId}: ${log.message}` : log.message}</code></div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

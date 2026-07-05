import type { MeetingRecord, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { Modal } from "../common/Modal";
import {
  formatRunTimestamp,
  getConfigDriftCount,
  getRunConfigSnapshot,
  getRunNode,
  nodeRunLabels,
  runStatusLabels
} from "./workflowPanelUtils";

type RunDetailDialogProps = {
  meeting: MeetingRecord | null;
  onClose: () => void;
  run: ProductWorkflowRun;
  template: ProductWorkflowTemplate;
};

export function RunDetailDialog({ meeting, onClose, run, template }: RunDetailDialogProps) {
  const configDriftCount = getConfigDriftCount(run, template);
  const manualRecords = run.nodeRuns
    .map((nodeRun) => ({
      nodeRun,
      note: typeof nodeRun.outputPayload?.resolutionNote === "string"
        ? nodeRun.outputPayload.resolutionNote
        : undefined
    }))
    .filter((record) => record.note);

  return (
    <Modal onClose={onClose} size="xl" title="运行详情">
      <div className="run-detail">
        <section className="run-detail__summary" aria-label="运行概览">
          <article><span>运行名称</span><strong>{run.name}</strong></article>
          <article><span>模板</span><strong>{template.name}</strong></article>
          <article><span>会议</span><strong>{meeting?.title ?? run.meetingId}</strong></article>
          <article><span>状态</span><strong>{runStatusLabels[run.status]}</strong></article>
          <article><span>开始</span><strong>{formatRunTimestamp(run.startedAt)}</strong></article>
          <article><span>结束</span><strong>{formatRunTimestamp(run.endedAt)}</strong></article>
          <article><span>耗时</span><strong>{run.durationSeconds}s</strong></article>
          <article><span>节点</span><strong>{run.nodeRuns.length}</strong></article>
          <article><span>配置变更</span><strong>{run.configSnapshot ? `${configDriftCount} 项` : "无快照"}</strong></article>
        </section>

        <div className="run-detail__grid">
          <section className="run-detail__section">
            <div className="run-detail__section-title"><strong>节点执行时间线</strong></div>
            <div className="run-timeline">
              {run.nodeRuns.map((nodeRun) => {
                const node = getRunNode(template, nodeRun.nodeId);
                return (
                  <article className={`run-timeline__item run-timeline__item--${nodeRun.status}`} key={nodeRun.nodeId}>
                    <span>{nodeRunLabels[nodeRun.status]}</span>
                    <strong>{node?.title ?? nodeRun.nodeId}</strong>
                    <p>{formatRunTimestamp(nodeRun.startedAt)} 至 {formatRunTimestamp(nodeRun.endedAt)}</p>
                    {nodeRun.errorMessage && <em>{nodeRun.errorMessage}</em>}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="run-detail__section">
            <div className="run-detail__section-title"><strong>人工处理记录</strong></div>
            {manualRecords.length > 0 ? (
              <div className="run-manual-list">
                {manualRecords.map(({ nodeRun, note }) => (
                  <article key={nodeRun.nodeId}>
                    <span>{getRunNode(template, nodeRun.nodeId)?.title ?? nodeRun.nodeId}</span>
                    <strong>{note}</strong>
                    <p>{formatRunTimestamp(nodeRun.endedAt)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="run-detail__empty">本次运行没有人工处理记录。</p>
            )}
          </section>

          <section className="run-detail__section run-detail__section--wide">
            <div className="run-detail__section-title"><strong>配置快照</strong></div>
            <div className="run-config-snapshot">
              {run.nodeRuns.map((nodeRun) => {
                const explicitSnapshot = run.configSnapshot?.find((item) => item.nodeId === nodeRun.nodeId);
                const currentNode = getRunNode(template, nodeRun.nodeId);
                const snapshot = getRunConfigSnapshot(run, template, nodeRun.nodeId);

                return (
                  <article key={nodeRun.nodeId}>
                    <strong>{snapshot.nodeTitle}</strong>
                    {!explicitSnapshot && <p>这条历史运行没有保存配置快照，下面显示当前模板配置。</p>}
                    <div>
                      {snapshot.configFields.length > 0 ? (
                        snapshot.configFields.map((field) => {
                          const currentField = currentNode?.configFields.find((item) => item.key === field.key);
                          const isChanged = Boolean(explicitSnapshot && currentField && currentField.value !== field.value);
                          return (
                            <code className={isChanged ? "is-changed" : ""} key={field.key}>
                              {field.label}: {field.value}
                              {isChanged && <em>当前: {currentField?.value}</em>}
                            </code>
                          );
                        })
                      ) : (
                        <code>无配置项</code>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="run-detail__section run-detail__section--wide">
            <div className="run-detail__section-title"><strong>原始日志</strong></div>
            <div className="run-log-table">
              {run.logs.map((log) => (
                <article className={`run-log-table__row run-log-table__row--${log.level}`} key={log.id}>
                  <span>{log.time}</span>
                  <code>{log.nodeId ?? "system"}</code>
                  <p>{log.message}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}

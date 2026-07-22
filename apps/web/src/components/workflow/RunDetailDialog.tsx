import type { MeetingRecord, ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { Modal } from "../common/Modal";
import { SelectableCardList } from "../common/SelectableCardList";
import { RunLatencyWaterfall } from "./RunLatencyWaterfall";
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
          {run.usage?.totalTokens ? <article><span>Token</span><strong>{run.usage.totalTokens}</strong></article> : null}
          <article><span>节点</span><strong>{run.nodeRuns.length}</strong></article>
          <article><span>配置变更</span><strong>{run.configSnapshot ? `${configDriftCount} 项` : "无快照"}</strong></article>
        </section>

        <section className="run-detail__section run-detail__section--wide">
          <RunLatencyWaterfall run={run} template={template} variant="full" />
        </section>

        <div className="run-detail__grid">
          <section className="run-detail__section">
            <div className="run-detail__section-title"><strong>节点执行时间线</strong></div>
            <SelectableCardList
              ariaLabel="节点执行时间线"
              className="run-timeline"
              items={run.nodeRuns.map((nodeRun) => {
                const node = getRunNode(template, nodeRun.nodeId);
                return {
                  id: nodeRun.nodeId,
                  title: node?.title ?? nodeRun.nodeId,
                  badge: nodeRunLabels[nodeRun.status],
                  description: nodeRun.errorMessage || undefined,
                  meta: `${formatRunTimestamp(nodeRun.startedAt)} 至 ${formatRunTimestamp(nodeRun.endedAt)}`,
                  className: `run-timeline__item run-timeline__item--${nodeRun.status} selectable-card--badge-leading`
                };
              })}
              layout="stack"
            />
          </section>

          <section className="run-detail__section">
            <div className="run-detail__section-title"><strong>人工处理记录</strong></div>
            <SelectableCardList
              ariaLabel="人工处理记录"
              className="run-manual-list"
              empty={<p className="run-detail__empty">本次运行没有人工处理记录。</p>}
              items={manualRecords.map(({ nodeRun, note }) => ({
                id: nodeRun.nodeId,
                title: note ?? "",
                badge: getRunNode(template, nodeRun.nodeId)?.title ?? nodeRun.nodeId,
                meta: formatRunTimestamp(nodeRun.endedAt),
                className: "selectable-card--badge-leading selectable-card--title-clamp"
              }))}
              layout="stack"
            />
          </section>

          <section className="run-detail__section run-detail__section--wide">
            <div className="run-detail__section-title"><strong>配置快照</strong></div>
            <SelectableCardList
              ariaLabel="配置快照"
              className="run-config-snapshot"
              items={run.nodeRuns.map((nodeRun) => {
                const explicitSnapshot = run.configSnapshot?.find((item) => item.nodeId === nodeRun.nodeId);
                const currentNode = getRunNode(template, nodeRun.nodeId);
                const snapshot = getRunConfigSnapshot(run, template, nodeRun.nodeId);

                return {
                  id: nodeRun.nodeId,
                  title: snapshot.nodeTitle,
                  className: "selectable-card--rich-body",
                  description: (
                    <>
                      {!explicitSnapshot ? (
                        <p>这条历史运行没有保存配置快照，下面显示当前模板配置。</p>
                      ) : null}
                      <div className="selectable-card__codes">
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
                    </>
                  )
                };
              })}
              layout="stack"
            />
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

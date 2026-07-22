import { useEffect, useMemo, useState } from "react";
import type { ProductWorkflowRun } from "@meeting-flow/shared";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { StatusBanner } from "../common/StatusBanner";
import { Dropdown } from "../common/Dropdown";
import { RunDetailDialog } from "../workflow/RunDetailDialog";
import { RunLatencyWaterfall } from "../workflow/RunLatencyWaterfall";
import {
  formatRunTimestamp,
  getRunNode,
  nodeRunLabels,
  runStatusFilterOptions,
  runStatusLabels,
  statusClass
} from "../workflow/workflowPanelUtils";
import {
  buildRunsConsoleStats,
  filterRunsConsole,
  getBlockedNodeRun,
  resolveRunContext,
  type RunsConsoleFilters
} from "../../lib/runsConsoleUtils";

export function RunsConsolePage() {
  const {
    meetings,
    workflow,
    setWorkbenchView,
    runsConsolePreset,
    clearRunsConsolePreset,
    focusRunInCanvas
  } = useWorkbench();

  const [filters, setFilters] = useState<RunsConsoleFilters>(() => ({
    status: runsConsolePreset?.status ?? "all",
    templateId: runsConsolePreset?.templateId ?? "",
    meetingId: runsConsolePreset?.meetingId ?? "",
    search: runsConsolePreset?.search ?? ""
  }));
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    if (!runsConsolePreset) {
      return;
    }

    setFilters({
      status: runsConsolePreset.status ?? "all",
      templateId: runsConsolePreset.templateId ?? "",
      meetingId: runsConsolePreset.meetingId ?? "",
      search: runsConsolePreset.search ?? ""
    });
  }, [runsConsolePreset]);

  const stats = useMemo(() => buildRunsConsoleStats(workflow.runs), [workflow.runs]);
  const filteredRuns = useMemo(
    () => filterRunsConsole(workflow.runs, filters),
    [filters, workflow.runs]
  );

  const selectedRun = filteredRuns.find((run) => run.id === selectedRunId)
    ?? workflow.runs.find((run) => run.id === selectedRunId)
    ?? filteredRuns[0]
    ?? null;

  const selectedContext = selectedRun
    ? resolveRunContext(selectedRun, workflow.templates, meetings.allMeetings)
    : { template: null, meeting: null };

  const blockedNodeRun = selectedRun ? getBlockedNodeRun(selectedRun) : undefined;
  const isBusy = workflow.isMutating;

  const templateFilterOptions = useMemo(
    () => [
      { label: "全部模板", value: "" },
      ...workflow.templates.map((template) => ({
        label: template.name,
        value: template.id
      }))
    ],
    [workflow.templates]
  );

  const meetingFilterOptions = useMemo(
    () => [
      { label: "全部会议", value: "" },
      ...meetings.allMeetings.map((meeting) => ({
        label: meeting.title,
        value: meeting.id
      }))
    ],
    [meetings.allMeetings]
  );

  function updateFilters(patch: Partial<RunsConsoleFilters>) {
    clearRunsConsolePreset();
    setFilters((current) => ({ ...current, ...patch }));
  }

  function handleSelectRun(run: ProductWorkflowRun) {
    setSelectedRunId(run.id);
    setResolutionNote("");
  }

  async function handleAdvance() {
    if (!selectedRun || !resolutionNote.trim()) return;
    const run = await workflow.advanceRunAndReloadMemories(selectedRun.id, resolutionNote.trim());
    if (run) {
      setSelectedRunId(run.id);
      setResolutionNote("");
    }
  }

  return (
    <section className="runs-console-page" aria-labelledby="runs-console-title">
      <div className="runs-console-page__header">
        <div>
          <span className="section-kicker">Run Console</span>
          <h1 id="runs-console-title">全局运行控制台</h1>
          <p>跨会议、跨模板查看流程运行状态，处理阻塞与失败任务。</p>
        </div>
        <div className="runs-console-page__header-actions">
          <button
            className="ghost-button"
            disabled={workflow.isLoading}
            onClick={() => void workflow.reloadWorkflowLibrary()}
            type="button"
          >
            刷新
          </button>
          <button className="ghost-button" onClick={() => setWorkbenchView("workspace")} type="button">
            返回流程画布
          </button>
        </div>
      </div>

      <StatusBanner error={workflow.error} feedback={workflow.feedback} />

      <div className="runs-console-page__stats" aria-label="运行概览">
        <article><span>全部</span><strong>{stats.total}</strong></article>
        <article className="is-running"><span>运行中</span><strong>{stats.running}</strong></article>
        <article className="is-blocked"><span>已阻塞</span><strong>{stats.blocked}</strong></article>
        <article className="is-failed"><span>失败</span><strong>{stats.failed}</strong></article>
        <article className="is-completed"><span>已完成</span><strong>{stats.completed}</strong></article>
      </div>

      <div className="runs-console-page__filters" aria-label="运行筛选">
        <div className="runs-console-page__filter-chips">
          {runStatusFilterOptions.map((option) => (
            <button
              className={`filter-chip${filters.status === option.value ? " is-active" : ""}`}
              key={option.value}
              onClick={() => updateFilters({ status: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <label>
          <span>模板</span>
          <Dropdown
            onChange={(value) => updateFilters({ templateId: value })}
            options={templateFilterOptions}
            value={filters.templateId}
          />
        </label>
        <label>
          <span>会议</span>
          <Dropdown
            onChange={(value) => updateFilters({ meetingId: value })}
            options={meetingFilterOptions}
            value={filters.meetingId}
          />
        </label>
        <label className="runs-console-page__search">
          <span>搜索</span>
          <input
            onChange={(event) => updateFilters({ search: event.target.value })}
            placeholder="运行名称或 ID"
            type="search"
            value={filters.search}
          />
        </label>
      </div>

      <div className="runs-console-page__body">
        <section className="runs-console-page__table-panel" aria-label="运行列表">
          {filteredRuns.length > 0 ? (
            <table className="runs-console-table">
              <thead>
                <tr>
                  <th>状态</th>
                  <th>运行</th>
                  <th>模板</th>
                  <th>会议</th>
                  <th>开始</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => {
                  const context = resolveRunContext(run, workflow.templates, meetings.allMeetings);
                  return (
                    <tr
                      className={run.id === selectedRun?.id ? "is-active" : ""}
                      key={run.id}
                      onClick={() => handleSelectRun(run)}
                    >
                      <td>
                        <span className={`run-status ${statusClass(run.status)}`}>
                          {runStatusLabels[run.status]}
                        </span>
                      </td>
                      <td>
                        <strong>{run.name}</strong>
                        <small>{run.id}</small>
                      </td>
                      <td>{context.template?.name ?? run.templateId}</td>
                      <td>{context.meeting?.title ?? run.meetingId}</td>
                      <td>{formatRunTimestamp(run.startedAt)}</td>
                      <td>{run.durationSeconds}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="run-empty">当前筛选条件下没有运行记录。</div>
          )}
        </section>

        <aside className="runs-console-page__detail" aria-label="运行详情">
          {selectedRun && selectedContext.template ? (
            <>
              <div className="runs-console-page__detail-head">
                <div>
                  <span className={`run-status ${statusClass(selectedRun.status)}`}>
                    {runStatusLabels[selectedRun.status]}
                  </span>
                  <strong>{selectedRun.name}</strong>
                  <p>
                    {selectedContext.template.name}
                    {" · "}
                    {selectedContext.meeting?.title ?? selectedRun.meetingId}
                  </p>
                </div>
              </div>

              <div className="runs-console-page__detail-meta">
                <article><span>开始</span><strong>{formatRunTimestamp(selectedRun.startedAt)}</strong></article>
                <article><span>结束</span><strong>{formatRunTimestamp(selectedRun.endedAt)}</strong></article>
                <article><span>耗时</span><strong>{selectedRun.durationSeconds}s</strong></article>
                <article><span>节点</span><strong>{selectedRun.nodeRuns.length}</strong></article>
              </div>

              <RunLatencyWaterfall
                run={selectedRun}
                template={selectedContext.template}
                variant="compact"
              />

              <div className="runs-console-page__timeline">
                {selectedRun.nodeRuns.map((nodeRun) => {
                  const node = getRunNode(selectedContext.template!, nodeRun.nodeId);
                  return (
                    <article className={`run-timeline__item run-timeline__item--${nodeRun.status}`} key={nodeRun.nodeId}>
                      <span>{nodeRunLabels[nodeRun.status]}</span>
                      <strong>{node?.title ?? nodeRun.nodeId}</strong>
                      {nodeRun.errorMessage && <em>{nodeRun.errorMessage}</em>}
                    </article>
                  );
                })}
              </div>

              {blockedNodeRun && (
                <textarea
                  aria-label="阻塞处理说明"
                  className="workflow-side-panel__note"
                  onChange={(event) => setResolutionNote(event.target.value)}
                  placeholder="记录阻塞处理说明后继续流程"
                  value={resolutionNote}
                />
              )}

              <div className="runs-console-page__actions">
                <button
                  className="ghost-button"
                  onClick={() => setIsDetailOpen(true)}
                  type="button"
                >
                  查看详情
                </button>
                <button
                  className="ghost-button"
                  onClick={() => focusRunInCanvas(selectedRun)}
                  type="button"
                >
                  在画布中打开
                </button>
                {blockedNodeRun && (
                  <button
                    className="primary-button"
                    disabled={isBusy || !resolutionNote.trim()}
                    onClick={() => void handleAdvance()}
                    type="button"
                  >
                    继续运行
                  </button>
                )}
                {selectedRun.status === "failed" && (
                  <button
                    className="primary-button"
                    disabled={isBusy}
                    onClick={() => void workflow.retryRunAndReloadMemories(selectedRun.id).then((run) => {
                      if (run) setSelectedRunId(run.id);
                    })}
                    type="button"
                  >
                    断点重试
                  </button>
                )}
                {selectedRun.status === "running" && (
                  <button
                    className="ghost-button"
                    disabled={isBusy}
                    onClick={() => void workflow.cancelWorkflowRun(selectedRun.id)}
                    type="button"
                  >
                    取消运行
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="run-empty">选择一条运行记录查看详情与操作。</div>
          )}
        </aside>
      </div>

      {isDetailOpen && selectedRun && selectedContext.template && (
        <RunDetailDialog
          meeting={selectedContext.meeting}
          onClose={() => setIsDetailOpen(false)}
          run={selectedRun}
          template={selectedContext.template}
        />
      )}
    </section>
  );
}

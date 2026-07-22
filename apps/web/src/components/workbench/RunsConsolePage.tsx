import { useEffect, useMemo } from "react";
import type { ProductWorkflowRun } from "@meeting-flow/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { canFilterRunsByOwnership, getProductRole } from "./layout/navAccess";
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
  resolveRunContext
} from "../../lib/runsConsoleUtils";
import { useRunsConsoleStore } from "../../stores/runsConsoleStore";
import { SelectableCardList } from "../common/SelectableCardList";
import { PageShell } from "./layout/PageShell";
import { ModelRuntimeBadge } from "./layout/ModelRuntimeBadge";

export function RunsConsolePage() {
  const { user } = useAuth();
  const {
    meetings,
    workflow,
    runsConsolePreset,
    clearRunsConsolePreset,
    focusRunInCanvas,
    derived
  } = useWorkbench();

  const canFilterByOwnership = user ? canFilterRunsByOwnership(getProductRole(user)) : false;

  const filters = useRunsConsoleStore((state) => state.filters);
  const isDetailOpen = useRunsConsoleStore((state) => state.isDetailOpen);
  const resolutionNote = useRunsConsoleStore((state) => state.resolutionNote);
  const selectedRunId = useRunsConsoleStore((state) => state.selectedRunId);
  const setDetailOpen = useRunsConsoleStore((state) => state.setDetailOpen);
  const setFilters = useRunsConsoleStore((state) => state.setFilters);
  const setResolutionNote = useRunsConsoleStore((state) => state.setResolutionNote);
  const setSelectedRunId = useRunsConsoleStore((state) => state.setSelectedRunId);
  const updateFilters = useRunsConsoleStore((state) => state.updateFilters);

  useEffect(() => {
    if (!runsConsolePreset) {
      return;
    }

    setFilters({
      status: runsConsolePreset.status ?? "all",
      templateId: runsConsolePreset.templateId ?? "",
      meetingId: runsConsolePreset.meetingId ?? "",
      ownerScope: "all",
      search: runsConsolePreset.search ?? ""
    });
  }, [runsConsolePreset, setFilters]);

  const stats = useMemo(() => buildRunsConsoleStats(workflow.runs), [workflow.runs]);
  const filteredRuns = useMemo(
    () => filterRunsConsole(workflow.runs, filters, {
      meetings: meetings.allMeetings,
      ownerUserId: canFilterByOwnership && filters.ownerScope === "mine" ? user?.id : undefined
    }),
    [canFilterByOwnership, filters, meetings.allMeetings, user?.id, workflow.runs]
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

  function handleFilterChange(patch: Parameters<typeof updateFilters>[0]) {
    clearRunsConsolePreset();
    updateFilters(patch);
  }

  function handleSelectRun(run: ProductWorkflowRun) {
    setSelectedRunId(run.id);
  }

  async function handleAdvance() {
    if (!selectedRun || !resolutionNote.trim()) return;
    const run = await workflow.advanceRunAndReloadMemories(selectedRun.id, resolutionNote.trim());
    if (run) {
      setSelectedRunId(run.id);
    }
  }

  return (
    <PageShell className="runs-console-page runs-console-page--observability" id="runs-console">
      <div className="runs-console__runtime"><ModelRuntimeBadge label={derived.modelRuntimeLabel} /></div>
      <div className="runs-console-page__toolbar">
        <button
          className="ghost-button"
          disabled={workflow.isLoading}
          onClick={() => void workflow.reloadWorkflowLibrary()}
          type="button"
        >
          刷新
        </button>
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
              onClick={() => handleFilterChange({ status: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        {canFilterByOwnership ? (
          <div className="runs-console-page__filter-chips">
            <button
              className={`filter-chip${filters.ownerScope === "all" ? " is-active" : ""}`}
              onClick={() => handleFilterChange({ ownerScope: "all" })}
              type="button"
            >
              全部会议
            </button>
            <button
              className={`filter-chip${filters.ownerScope === "mine" ? " is-active" : ""}`}
              onClick={() => handleFilterChange({ ownerScope: "mine" })}
              type="button"
            >
              我创建的
            </button>
          </div>
        ) : null}
        <label>
          <span>模板</span>
          <Dropdown
            onChange={(value) => handleFilterChange({ templateId: value })}
            options={templateFilterOptions}
            value={filters.templateId}
          />
        </label>
        <label>
          <span>会议</span>
          <Dropdown
            onChange={(value) => handleFilterChange({ meetingId: value })}
            options={meetingFilterOptions}
            value={filters.meetingId}
          />
        </label>
        <label className="runs-console-page__search">
          <span>搜索</span>
          <input
            onChange={(event) => handleFilterChange({ search: event.target.value })}
            placeholder="运行名称或 ID"
            type="search"
            value={filters.search}
          />
        </label>
      </div>

      <div className="runs-console-page__observability">
        <section className="runs-console-page__runs" aria-label="运行列表">
          <SelectableCardList
            ariaLabel="运行记录"
            empty={<div className="run-empty">当前筛选条件下没有运行记录。</div>}
            items={filteredRuns.map((run) => {
              const context = resolveRunContext(run, workflow.templates, meetings.allMeetings);
              return {
                id: run.id,
                title: run.name,
                badge: runStatusLabels[run.status],
                badgeClassName: `run-status ${statusClass(run.status)}`,
                description: context.template?.name ?? run.templateId,
                meta: `${context.meeting?.title ?? run.meetingId} · ${formatRunTimestamp(run.startedAt)} · ${run.durationSeconds}s`,
                className: "selectable-card--badge-leading"
              };
            })}
            layout="stack"
            onSelect={(id) => {
              const run = filteredRuns.find((item) => item.id === id);
              if (run) {
                handleSelectRun(run);
              }
            }}
            selectedId={selectedRun?.id ?? null}
          />
        </section>

        <section className={`runs-console-page__trace${selectedRun ? " is-open" : ""}`} aria-label="运行追踪">
          {selectedRun && selectedContext.template ? (
            <>
              <div className="runs-console-page__trace-head">
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
                <button className="ghost-button" onClick={() => setDetailOpen(true)} type="button">
                  详情
                </button>
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
                      {nodeRun.errorMessage ? <em>{nodeRun.errorMessage}</em> : null}
                    </article>
                  );
                })}
              </div>

              {blockedNodeRun ? (
                <textarea
                  aria-label="阻塞处理说明"
                  className="runs-console-page__note"
                  onChange={(event) => setResolutionNote(event.target.value)}
                  placeholder="记录阻塞处理说明后继续流程"
                  value={resolutionNote}
                />
              ) : null}

              <div className="runs-console-page__actions">
                <button
                  className="ghost-button"
                  onClick={() => focusRunInCanvas(selectedRun)}
                  type="button"
                >
                  在画布中打开
                </button>
                {blockedNodeRun ? (
                  <button
                    className="primary-button"
                    disabled={isBusy || !resolutionNote.trim()}
                    onClick={() => void handleAdvance()}
                    type="button"
                  >
                    继续运行
                  </button>
                ) : null}
                {selectedRun.status === "failed" ? (
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
                ) : null}
                {selectedRun.status === "running" ? (
                  <button
                    className="ghost-button"
                    disabled={isBusy}
                    onClick={() => void workflow.cancelWorkflowRun(selectedRun.id)}
                    type="button"
                  >
                    取消运行
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="run-empty">选择一条运行记录查看追踪时间线。</div>
          )}
        </section>
      </div>

      {isDetailOpen && selectedRun && selectedContext.template ? (
        <RunDetailDialog
          meeting={selectedContext.meeting}
          onClose={() => setDetailOpen(false)}
          run={selectedRun}
          template={selectedContext.template}
        />
      ) : null}
    </PageShell>
  );
}

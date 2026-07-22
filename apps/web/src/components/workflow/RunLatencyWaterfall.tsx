import type { ProductWorkflowRun, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { buildRunLatencyWaterfall, getRunLatencyAxisMarks } from "../../lib/runLatencyWaterfall";
import { nodeRunLabels } from "./workflowPanelUtils";

type RunLatencyWaterfallProps = {
  run: ProductWorkflowRun;
  template?: ProductWorkflowTemplate | null;
  variant?: "compact" | "full";
};

export function RunLatencyWaterfall({ run, template, variant = "full" }: RunLatencyWaterfallProps) {
  const model = buildRunLatencyWaterfall(run, template);
  const axisMarks = getRunLatencyAxisMarks(model.totalMs);
  const visibleWaves = variant === "compact"
    ? model.waves
        .map((wave) => ({
          ...wave,
          segments: [...wave.segments]
            .filter((segment) => segment.hasTiming)
            .sort((left, right) => right.durationMs - left.durationMs)
            .slice(0, 3)
        }))
        .filter((wave) => wave.segments.length > 0)
        .slice(0, 4)
    : model.waves;

  if (!model.hasTiming) {
    return (
      <div className={`run-latency-waterfall run-latency-waterfall--${variant} run-latency-waterfall--empty`}>
        <p className="run-latency-waterfall__empty">暂无节点级时序数据，完成一次带时间戳的运行后可查看延迟瀑布图。</p>
      </div>
    );
  }

  return (
    <div className={`run-latency-waterfall run-latency-waterfall--${variant}`} aria-label="运行延迟瀑布图">
      <div className="run-latency-waterfall__header">
        <strong>Latency 瀑布图</strong>
        <span>{model.totalLabel} wall time</span>
        {run.usage?.totalTokens ? <span>{run.usage.totalTokens} tokens</span> : null}
      </div>

      <div className="run-latency-waterfall__axis" aria-hidden="true">
        {axisMarks.map((mark) => (
          <span key={mark.percent} style={{ left: `${mark.percent}%` }}>
            {mark.label}
          </span>
        ))}
      </div>

      <div className="run-latency-waterfall__waves">
        {visibleWaves.map((wave) => (
          <section className="run-latency-waterfall__wave" key={`wave-${wave.wave}`}>
            <div className="run-latency-waterfall__wave-title">
              <strong>{wave.label}</strong>
              {wave.parallelCount > 1 ? <span>同波并行</span> : null}
            </div>
            <div className={`run-latency-waterfall__rows${wave.parallelCount > 1 ? " run-latency-waterfall__rows--parallel" : ""}`}>
              {wave.segments.map((segment) => (
                <div className="run-latency-waterfall__row" key={segment.nodeId}>
                  <div className="run-latency-waterfall__label">
                    <strong>{segment.label}</strong>
                    <small>{nodeRunLabels[segment.status]}</small>
                  </div>
                  <div className="run-latency-waterfall__track">
                    {segment.hasTiming ? (
                      <div
                        className={`run-latency-waterfall__bar run-latency-waterfall__bar--${segment.status}`}
                        style={{
                          left: `${segment.offsetPercent}%`,
                          width: `${segment.widthPercent}%`
                        }}
                        title={`${segment.label} · ${segment.durationLabel}`}
                      >
                        <span>{segment.durationLabel}</span>
                      </div>
                    ) : (
                      <span className="run-latency-waterfall__placeholder">{segment.durationLabel}</span>
                    )}
                  </div>
                  <div className="run-latency-waterfall__meta">
                    {segment.tokens ? <code>{segment.tokens.total} tok</code> : <code>—</code>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {variant === "compact" && model.waves.length > visibleWaves.length ? (
        <p className="run-latency-waterfall__hint">仅展示前 {visibleWaves.length} 个 wave，完整视图见运行详情。</p>
      ) : null}
    </div>
  );
}

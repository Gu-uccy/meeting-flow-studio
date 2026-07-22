import type { AuditLogEntry } from "@meeting-flow/shared";
import { formatDateTime } from "../../lib/format";
import { auditActionLabels } from "../../lib/auditUtils";

type AuditTimelinePanelProps = {
  error: string;
  isLoading: boolean;
  items: AuditLogEntry[];
  onReload: () => void;
};

export function AuditTimelinePanel({ error, isLoading, items, onReload }: AuditTimelinePanelProps) {
  return (
    <article className="account-panel account-panel--audit">
      <div className="account-panel__head">
        <h2>工作区操作记录</h2>
        <button className="ghost-button" disabled={isLoading} onClick={onReload} type="button">
          {isLoading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {error ? <p className="audit-timeline__error">{error}</p> : null}

      <div className="audit-timeline">
        {isLoading && items.length === 0 ? (
          <p className="audit-timeline__placeholder">加载操作记录…</p>
        ) : items.length === 0 ? (
          <p className="audit-timeline__placeholder">暂无操作记录</p>
        ) : (
          items.map((entry) => (
            <article className="audit-timeline__item" key={entry.id}>
              <div className="audit-timeline__marker" aria-hidden="true" />
              <div className="audit-timeline__body">
                <div className="audit-timeline__meta">
                  <strong>{auditActionLabels[entry.action]}</strong>
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                </div>
                <p>{entry.summary}</p>
                <span>{entry.actorName}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </article>
  );
}

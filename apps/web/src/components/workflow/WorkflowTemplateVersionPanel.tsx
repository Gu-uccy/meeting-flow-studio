import { useMemo, useState } from "react";
import type { ProductWorkflowTemplate, ProductWorkflowTemplateVersion } from "@meeting-flow/shared";
import { formatDateTime } from "../../lib/format";
import {
  buildTemplateVersionDiffRows,
  countTemplateVersionChanges
} from "../../lib/templateVersionDiff";

type WorkflowTemplateVersionPanelProps = {
  isCanvasDirty: boolean;
  isWorkflowActionBusy: boolean;
  onApplyVersion: (versionId: string) => void;
  onCreateVersion: (status: ProductWorkflowTemplateVersion["status"], summary?: string) => void;
  onSaveCanvas: () => void;
  selectedTemplate: ProductWorkflowTemplate;
};

export function WorkflowTemplateVersionPanel(props: WorkflowTemplateVersionPanelProps) {
  const {
    isCanvasDirty,
    isWorkflowActionBusy,
    onApplyVersion,
    onCreateVersion,
    onSaveCanvas,
    selectedTemplate
  } = props;

  const versions = selectedTemplate.versions ?? [];
  const [isExpanded, setIsExpanded] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [baseVersionId, setBaseVersionId] = useState(versions[0]?.id ?? "");
  const [targetVersionId, setTargetVersionId] = useState(versions[1]?.id ?? versions[0]?.id ?? "");

  const baseVersion = versions.find((version) => version.id === baseVersionId) ?? versions[0] ?? null;
  const targetVersion = versions.find((version) => version.id === targetVersionId) ?? versions[1] ?? versions[0] ?? null;

  const diffRows = useMemo(() => {
    if (!baseVersion || !targetVersion) {
      return [];
    }

    return buildTemplateVersionDiffRows(baseVersion, targetVersion);
  }, [baseVersion, targetVersion]);

  const canCreateVersion = !isCanvasDirty && !isWorkflowActionBusy;

  return (
    <section
      className={`workflow-template-version-panel${isExpanded ? " is-expanded" : " is-collapsed"}`}
      aria-label="模板版本管理"
    >
      <div className="workflow-template-version-panel__head">
        <div>
          <span className="section-kicker">Template Versions</span>
          <strong>模板版本 / 回滚</strong>
          <p>
            {isExpanded
              ? "保存画布快照或发布版本，并对比节点与配置变更。"
              : `${versions.length} 条版本记录，展开后可对比与回滚。`}
          </p>
        </div>
        <div className="workflow-template-version-panel__actions">
          <button
            className="ghost-button"
            disabled={!canCreateVersion}
            onClick={() => onCreateVersion("snapshot", summaryDraft)}
            type="button"
          >
            保存快照
          </button>
          <button
            className="primary-button"
            disabled={!canCreateVersion}
            onClick={() => onCreateVersion("published", summaryDraft)}
            type="button"
          >
            发布版本
          </button>
          <button
            aria-expanded={isExpanded}
            className="ghost-button"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            {isExpanded ? "收起" : "展开"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
      {isCanvasDirty && (
        <p className="workflow-template-version-panel__hint">
          画布有未保存修改。请先
          <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onSaveCanvas()} type="button">
            保存画布
          </button>
          再创建版本。
        </p>
      )}

      <label className="workflow-template-version-panel__summary">
        <span>版本说明</span>
        <input
          disabled={isWorkflowActionBusy}
          onChange={(event) => setSummaryDraft(event.target.value)}
          placeholder="例如：调整 AI 节点 Prompt 与连线"
          type="text"
          value={summaryDraft}
        />
      </label>

      <div className="workflow-template-version-panel__body">
        <div className="workflow-template-version-list">
          <div className="ide-section-title">
            <strong>版本记录</strong>
            <span>{versions.length} 条</span>
          </div>
          {versions.length > 0 ? (
            versions.slice(0, 8).map((version) => (
              <article className="workflow-template-version-row" key={version.id}>
                <div>
                  <strong>{version.version}</strong>
                  <span className={`integration-badge integration-badge--${version.status === "published" ? "ready" : "attention"}`}>
                    {version.status === "published" ? "已发布" : "快照"}
                  </span>
                </div>
                <p>{version.summary}</p>
                <small>{version.createdBy} · {formatDateTime(version.createdAt)} · {version.nodes.length} 节点 / {version.edges.length} 连线</small>
                <button
                  className="ghost-button"
                  disabled={isWorkflowActionBusy || isCanvasDirty}
                  onClick={() => onApplyVersion(version.id)}
                  type="button"
                >
                  回滚到此版本
                </button>
              </article>
            ))
          ) : (
            <p className="workflow-template-version-empty">暂无版本记录，保存快照或发布版本后可在此回滚。</p>
          )}
        </div>

        <div className="workflow-template-version-diff">
          <div className="ide-section-title">
            <strong>版本 Diff</strong>
            <span>{baseVersion && targetVersion ? `${countTemplateVersionChanges(diffRows)} 处变更` : "选择两个版本"}</span>
          </div>

          {versions.length > 0 && (
            <div className="workflow-template-version-diff__pickers">
              <label>
                <span>基准版本</span>
                <select onChange={(event) => setBaseVersionId(event.target.value)} value={baseVersion?.id ?? ""}>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version} / {version.status === "published" ? "已发布" : "快照"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>对比版本</span>
                <select onChange={(event) => setTargetVersionId(event.target.value)} value={targetVersion?.id ?? ""}>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.version} / {version.status === "published" ? "已发布" : "快照"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {baseVersion && targetVersion && (
            <>
              <div className="workflow-template-version-diff__table">
                {diffRows.map((row) => (
                  <article className={`workflow-template-version-diff__row${row.changed ? " is-changed" : ""}`} key={row.label}>
                    <header>
                      <strong>{row.label}</strong>
                      <span>{row.changed ? "已变更" : "一致"}</span>
                    </header>
                    <div className="workflow-template-version-diff__columns">
                      <pre>{row.before || "（空）"}</pre>
                      <pre>{row.after || "（空）"}</pre>
                    </div>
                  </article>
                ))}
              </div>
              <div className="workflow-template-version-diff__actions">
                <button className="ghost-button" disabled={isWorkflowActionBusy || isCanvasDirty} onClick={() => onApplyVersion(baseVersion.id)} type="button">
                  回滚到基准版本
                </button>
                <button className="primary-button" disabled={isWorkflowActionBusy || isCanvasDirty} onClick={() => onApplyVersion(targetVersion.id)} type="button">
                  应用对比版本
                </button>
              </div>
            </>
          )}
        </div>
      </div>
        </>
      )}
    </section>
  );
}

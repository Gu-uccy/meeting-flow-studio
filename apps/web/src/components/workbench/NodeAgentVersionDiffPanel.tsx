import { useMemo, useState } from "react";
import type { AiApplicationVersion } from "@meeting-flow/shared";
import { formatDateTime } from "../../lib/format";
import { buildVersionDiffRows, countVersionChanges } from "../../lib/versionDiff";

type NodeAgentVersionDiffPanelProps = {
  currentVersionLabel: string;
  isWorkflowMutating: boolean;
  onApplyVersion: (versionId: string) => void;
  versions: AiApplicationVersion[];
};

export function NodeAgentVersionDiffPanel(props: NodeAgentVersionDiffPanelProps) {
  const { currentVersionLabel, isWorkflowMutating, onApplyVersion, versions } = props;
  const [baseVersionId, setBaseVersionId] = useState(versions[0]?.id ?? "");
  const [targetVersionId, setTargetVersionId] = useState(versions[1]?.id ?? versions[0]?.id ?? "");

  const baseVersion = versions.find((version) => version.id === baseVersionId) ?? versions[0] ?? null;
  const targetVersion = versions.find((version) => version.id === targetVersionId) ?? versions[1] ?? versions[0] ?? null;

  const diffRows = useMemo(() => {
    if (!baseVersion || !targetVersion) {
      return [];
    }

    return buildVersionDiffRows(baseVersion, targetVersion);
  }, [baseVersion, targetVersion]);

  if (versions.length === 0) {
    return (
      <section className="node-agent-version-diff" aria-label="版本对比">
        <div className="node-agent-editor__section-title">
          <span>版本 Diff</span>
          <small>暂无版本</small>
        </div>
        <div className="node-agent-inline-empty">保存快照后可在此对比 Prompt / Schema 变更。</div>
      </section>
    );
  }

  return (
    <section className="node-agent-version-diff" aria-label="版本对比">
      <div className="node-agent-editor__section-title">
        <span>版本 Diff</span>
        <small>{baseVersion && targetVersion ? `${countVersionChanges(diffRows)} 处变更` : "选择两个版本进行对比"}</small>
      </div>

      <div className="node-agent-version-diff__pickers">
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

      {baseVersion && targetVersion && (
        <>
          <div className="node-agent-version-diff__meta">
            <span>当前运行：{currentVersionLabel}</span>
            <span>{formatDateTime(baseVersion.createdAt)} → {formatDateTime(targetVersion.createdAt)}</span>
          </div>

          <div className="node-agent-version-diff__table">
            {diffRows.map((row) => (
              <article className={`node-agent-version-diff__row${row.changed ? " is-changed" : ""}`} key={row.label}>
                <header>
                  <strong>{row.label}</strong>
                  <span>{row.changed ? "已变更" : "一致"}</span>
                </header>
                <div className="node-agent-version-diff__columns">
                  <pre>{row.before || "（空）"}</pre>
                  <pre>{row.after || "（空）"}</pre>
                </div>
              </article>
            ))}
          </div>

          <div className="node-agent-version-diff__actions">
            <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => onApplyVersion(baseVersion.id)} type="button">
              回滚到基准版本
            </button>
            <button className="primary-button" disabled={isWorkflowMutating} onClick={() => onApplyVersion(targetVersion.id)} type="button">
              应用对比版本
            </button>
          </div>
        </>
      )}
    </section>
  );
}

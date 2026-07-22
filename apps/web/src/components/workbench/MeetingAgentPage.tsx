import { useMemo } from "react";
import type { MeetingAgentAction, MeetingAgentRun, MeetingRecordWithPermissions } from "@meeting-flow/shared";
import { agentActionPriorityLabels, agentInsightKindLabels } from "../workflow/workflowPanelUtils";
import { formatDateTime } from "../../lib/format";
import { SelectableCardList } from "../common/SelectableCardList";
import { MeetingReadOnlyBanner } from "./layout/MeetingReadOnlyBanner";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";
import { ModelRuntimeBadge } from "./layout/ModelRuntimeBadge";

type MeetingAgentPageProps = {
  agentActionFeedback?: string;
  agentError?: string;
  agentRun: MeetingAgentRun | null;
  hint?: string | null;
  isAgentRunning: boolean;
  isBusy?: boolean;
  meeting: MeetingRecordWithPermissions | null;
  onExecuteAgentAction: (action: MeetingAgentAction) => void;
  onRunAgent: () => void;
  readOnly?: boolean;
  runtimeLabel?: string;
};

export function MeetingAgentPage({
  agentActionFeedback = "",
  agentError = "",
  agentRun,
  hint,
  isAgentRunning,
  isBusy = false,
  meeting,
  onExecuteAgentAction,
  onRunAgent,
  readOnly = false,
  runtimeLabel = "未配置密钥"
}: MeetingAgentPageProps) {
  const busy = isBusy || isAgentRunning;

  const actionable = useMemo(
    () => agentRun?.actions.filter((action) => action.kind !== "none") ?? [],
    [agentRun]
  );

  const insightCards = useMemo(
    () =>
      (agentRun?.insights ?? []).slice(0, 6).map((insight) => ({
        id: insight.id,
        title: insight.title,
        badge: agentInsightKindLabels[insight.kind],
        description: insight.description,
        className: "selectable-card--badge-leading"
      })),
    [agentRun]
  );

  const actionCards = useMemo(
    () =>
      actionable.map((action) => ({
        id: action.id,
        title: action.title,
        badge: agentActionPriorityLabels[action.priority],
        description: action.description,
        className: `selectable-card--badge-leading priority-${action.priority}`,
        actions: !readOnly ? (
          <button
            className="ghost-button"
            disabled={busy || action.kind === "none"}
            onClick={() => onExecuteAgentAction(action)}
            type="button"
          >
            执行
          </button>
        ) : undefined
      })),
    [actionable, busy, onExecuteAgentAction, readOnly]
  );

  if (!meeting) {
    return (
      <MeetingWorkspaceLayout hint={hint}>
        <section className="workbench-empty workbench-empty--canvas" aria-label="工作流 Agent">
          <h2>选择会议运行 Agent</h2>
          <p>从顶栏选择会议后，可自动匹配模板并推进流程。</p>
        </section>
      </MeetingWorkspaceLayout>
    );
  }

  return (
    <MeetingWorkspaceLayout hint={hint}>
      <section className="meeting-tool-page agent-page" aria-label="工作流 Agent">
        <MeetingReadOnlyBanner meeting={meeting} />

        <header className="meeting-tool-page__header">
          <div className="meeting-tool-page__header-copy">
            <strong>{meeting.title}</strong>
            <p>自动匹配模板并推进会议流程</p>
          </div>
          <div className="meeting-tool-page__header-actions">
              <ModelRuntimeBadge label={runtimeLabel} />
            {!readOnly ? (
              <button className="primary-button" disabled={busy} onClick={onRunAgent} type="button">
                {isAgentRunning ? "Agent 运行中..." : "运行 Agent"}
              </button>
            ) : null}
          </div>
        </header>

        <div className="meeting-tool-page__meta" aria-label="Agent 状态">
          <span>
            模型 <strong>{agentRun?.model ?? "待运行"}</strong>
          </span>
          <span>
            建议动作 <strong>{actionable.length}</strong>
          </span>
          {agentRun?.createdAt ? (
            <span>
              最近运行 <strong>{formatDateTime(agentRun.createdAt)}</strong>
            </span>
          ) : null}
        </div>

        {(agentError || agentActionFeedback) ? (
          <p className="meeting-tool-page__feedback">{agentError || agentActionFeedback}</p>
        ) : null}

        <div className="meeting-tool-page__body agent-page__body">
          <section className="meeting-tool-page__section" aria-label="运行摘要">
            <div className="meeting-tool-page__section-title">
              <strong>运行摘要</strong>
            </div>
            <p className="agent-page__summary">
              {agentRun?.summary ?? "选择会议后运行 Agent，将根据会议上下文匹配模板并给出推进建议。"}
            </p>
            {insightCards.length > 0 ? (
              <SelectableCardList
                ariaLabel="Agent 洞察"
                className="agent-page__insights"
                items={insightCards}
                layout="stack"
              />
            ) : null}
          </section>

          <section className="meeting-tool-page__section" aria-label="建议动作">
            <div className="meeting-tool-page__section-title">
              <strong>建议动作</strong>
              <span>{actionable.length} 项</span>
            </div>
            <div className="meeting-tool-page__rows scroll-area">
              <SelectableCardList
                ariaLabel="建议动作"
                empty={<p className="meeting-tool-page__empty">暂无建议动作，先运行 Agent。</p>}
                items={actionCards}
                layout="stack"
              />
            </div>
          </section>
        </div>
      </section>
    </MeetingWorkspaceLayout>
  );
}

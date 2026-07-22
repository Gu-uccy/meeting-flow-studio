import { useMemo, useState } from "react";
import type { MeetingRecordWithPermissions, ProductWorkflowTemplate } from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";
import { SelectableCardList } from "../common/SelectableCardList";
import { useWorkflowSchedules } from "../../hooks/useWorkflowSchedules";
import { formatDateTime } from "../../lib/format";
import { MeetingReadOnlyBanner } from "./layout/MeetingReadOnlyBanner";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";

const cronPresets = [
  { label: "每日 08:00", value: "0 8 * * *" },
  { label: "每周一 09:00", value: "0 9 * * 1" },
  { label: "每小时整点", value: "0 * * * *" }
] as const;

type MeetingSchedulesPageProps = {
  hint?: string | null;
  isBusy?: boolean;
  meeting: MeetingRecordWithPermissions | null;
  readOnly?: boolean;
  workflowTemplates: ProductWorkflowTemplate[];
};

export function MeetingSchedulesPage({
  hint,
  isBusy = false,
  meeting,
  readOnly = false,
  workflowTemplates
}: MeetingSchedulesPageProps) {
  const schedules = useWorkflowSchedules(true);
  const [scheduleTemplateId, setScheduleTemplateId] = useState("");
  const [scheduleMeetingId, setScheduleMeetingId] = useState("");
  const [scheduleCron, setScheduleCron] = useState<string>(cronPresets[0].value);
  const [selectedId, setSelectedId] = useState("");

  const selectedSchedule = schedules.items.find((item) => item.id === selectedId) ?? schedules.items[0] ?? null;
  const selectedTemplate = selectedSchedule
    ? workflowTemplates.find((template) => template.id === selectedSchedule.templateId)
    : null;
  const busy = isBusy || schedules.isMutating;

  const scheduleCards = useMemo(
    () =>
      schedules.items.map((schedule) => {
        const template = workflowTemplates.find((item) => item.id === schedule.templateId);
        return {
          id: schedule.id,
          title: template?.name ?? schedule.templateId,
          badge: schedule.enabled ? "启用" : "停用",
          meta: schedule.cronExpression,
          className: "selectable-card--badge-leading"
        };
      }),
    [schedules.items, workflowTemplates]
  );
  const activeTemplateId = scheduleTemplateId || workflowTemplates[0]?.id || "";

  return (
    <MeetingWorkspaceLayout hint={hint || schedules.error || schedules.feedback}>
      <section className="meeting-tool-page schedules-page" aria-label="定时任务">
        {meeting ? <MeetingReadOnlyBanner meeting={meeting} /> : null}

        <header className="meeting-tool-page__header">
          <div className="meeting-tool-page__header-copy">
            <strong>定时任务</strong>
            <p>按 Cron 表达式自动启动工作流{meeting ? ` · 当前会议：${meeting.title}` : ""}</p>
          </div>
        </header>

        <div className="meeting-tool-page__meta" aria-label="任务统计">
          <span>
            全部 <strong>{schedules.items.length}</strong>
          </span>
          <span>
            启用中 <strong>{schedules.items.filter((item) => item.enabled).length}</strong>
          </span>
        </div>

        {(schedules.error || schedules.feedback) ? (
          <p className="meeting-tool-page__feedback">{schedules.error || schedules.feedback}</p>
        ) : null}

        <div className="meeting-tool-page__body schedules-page__body">
          <aside className="schedules-page__aside" aria-label="创建与列表">
            {!readOnly ? (
              <section className="meeting-tool-page__section schedules-page__create" aria-label="创建定时任务">
                <div className="meeting-tool-page__section-title">
                  <strong>新建计划</strong>
                </div>
                <label className="schedules-page__field">
                  <span>工作流模板</span>
                  <Dropdown
                    onChange={setScheduleTemplateId}
                    options={workflowTemplates.map((template) => ({
                      label: template.name,
                      value: template.id
                    }))}
                    value={activeTemplateId}
                  />
                </label>
                <label className="schedules-page__field">
                  <span>绑定会议</span>
                  <Dropdown
                    onChange={setScheduleMeetingId}
                    options={[
                      { label: "自动匹配（按模板类别）", value: "" },
                      ...(meeting ? [{ label: meeting.title, value: meeting.id }] : [])
                    ]}
                    value={scheduleMeetingId || meeting?.id || ""}
                  />
                </label>
                <label className="schedules-page__field">
                  <span>Cron 表达式</span>
                  <input onChange={(event) => setScheduleCron(event.target.value)} placeholder="0 8 * * *" value={scheduleCron} />
                </label>
                <div className="schedules-page__presets">
                  {cronPresets.map((preset) => (
                    <button
                      className={`filter-chip${scheduleCron === preset.value ? " is-active" : ""}`}
                      key={preset.value}
                      onClick={() => setScheduleCron(preset.value)}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <button
                  className="primary-button"
                  disabled={busy || !activeTemplateId}
                  onClick={() => void schedules.createSchedule(
                    activeTemplateId,
                    scheduleCron,
                    scheduleMeetingId || meeting?.id || undefined
                  )}
                  type="button"
                >
                  {schedules.isMutating ? "创建中..." : "创建定时任务"}
                </button>
              </section>
            ) : null}

            <section className="meeting-tool-page__section schedules-page__list" aria-label="定时任务列表">
              <div className="meeting-tool-page__section-title">
                <strong>任务列表</strong>
                <span>{schedules.items.length} 项</span>
              </div>
              <div className="meeting-tool-page__rows scroll-area">
                <SelectableCardList
                  ariaLabel="定时任务"
                  empty={
                    schedules.isLoading && schedules.items.length === 0 ? (
                      <p className="meeting-tool-page__empty">加载中…</p>
                    ) : (
                      <p className="meeting-tool-page__empty">暂无定时任务。</p>
                    )
                  }
                  items={scheduleCards}
                  layout="stack"
                  onSelect={setSelectedId}
                  selectedId={selectedSchedule?.id ?? null}
                />
              </div>
            </section>
          </aside>

          <section className="meeting-tool-page__section schedules-page__detail" aria-label="任务详情">
            {selectedSchedule ? (
              <>
                <div className="meeting-tool-page__section-title">
                  <strong>{selectedTemplate?.name ?? selectedSchedule.templateId}</strong>
                  <span>{selectedSchedule.enabled ? "启用中" : "已停用"}</span>
                </div>
                <dl className="meeting-tool-page__detail-meta">
                  <div>
                    <dt>Cron</dt>
                    <dd>{selectedSchedule.cronExpression}</dd>
                  </div>
                  <div>
                    <dt>绑定会议</dt>
                    <dd>{selectedSchedule.meetingId || "自动匹配"}</dd>
                  </div>
                  <div>
                    <dt>上次触发</dt>
                    <dd>{selectedSchedule.lastTriggeredAt ? formatDateTime(selectedSchedule.lastTriggeredAt) : "尚未触发"}</dd>
                  </div>
                  {selectedSchedule.executionHistory?.[0] ? (
                    <div>
                      <dt>最近运行</dt>
                      <dd>{selectedSchedule.executionHistory[0].status}</dd>
                    </div>
                  ) : null}
                </dl>
                {!readOnly ? (
                  <div className="schedules-page__detail-actions">
                    <button
                      className="ghost-button"
                      disabled={busy}
                      onClick={() => void schedules.updateSchedule(selectedSchedule.id, { enabled: !selectedSchedule.enabled })}
                      type="button"
                    >
                      {selectedSchedule.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      className="danger-button"
                      disabled={busy}
                      onClick={() => void schedules.deleteSchedule(selectedSchedule.id).then(() => {
                        if (selectedId === selectedSchedule.id) {
                          setSelectedId("");
                        }
                      })}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="meeting-tool-page__empty">选择一条任务查看详情。</p>
            )}
          </section>
        </div>
      </section>
    </MeetingWorkspaceLayout>
  );
}

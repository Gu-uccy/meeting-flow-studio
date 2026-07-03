import {
  meetingChannelLabels,
  meetingChannelValues,
  meetingPriorityLabels,
  meetingPriorityValues,
  meetingTypeLabels,
  meetingTypeValues,
  participantRoleLabels,
  participantRoleValues,
  participantStatusLabels,
  participantStatusValues,
  type CreateMeetingInput,
  type MeetingAgendaItemInput,
  type MeetingParticipantInput
} from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";

type MeetingCreateFormProps = {
  formState: CreateMeetingInput;
  isSubmitting: boolean;
  onFieldChange: <Key extends keyof CreateMeetingInput>(key: Key, value: CreateMeetingInput[Key]) => void;
  onParticipantChange: (
    index: number,
    key: keyof MeetingParticipantInput,
    value: MeetingParticipantInput[keyof MeetingParticipantInput]
  ) => void;
  onAddParticipant: () => void;
  onRemoveParticipant: (index: number) => void;
  onAgendaItemChange: (
    index: number,
    key: keyof MeetingAgendaItemInput,
    value: MeetingAgendaItemInput[keyof MeetingAgendaItemInput]
  ) => void;
  onAddAgendaItem: () => void;
  onRemoveAgendaItem: (index: number) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
};

function isFilled(value: string) {
  return value.trim().length > 0;
}

function getInitials(value: string, fallback: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, 1) : fallback;
}

export function MeetingCreateForm({
  formState,
  isSubmitting,
  onFieldChange,
  onParticipantChange,
  onAddParticipant,
  onRemoveParticipant,
  onAgendaItemChange,
  onAddAgendaItem,
  onRemoveAgendaItem,
  onSubmit
}: MeetingCreateFormProps) {
  const namedParticipants = formState.participants.filter((participant) => isFilled(participant.name));
  const filledAgendaItems = formState.agendaItems.filter((item) => isFilled(item.title));
  const tags = formState.tags.slice(0, 4);
  const completionSteps = [
    {
      done: isFilled(formState.title) && isFilled(formState.host) && isFilled(formState.owner),
      label: "基础"
    },
    {
      done: isFilled(formState.description) && isFilled(formState.meetingGoal),
      label: "目标"
    },
    {
      done: isFilled(formState.startAt) && isFilled(formState.endAt),
      label: "排期"
    },
    {
      done: namedParticipants.length > 0 && filledAgendaItems.length > 0,
      label: "协作"
    }
  ];
  const completedStepCount = completionSteps.filter((step) => step.done).length;

  return (
    <aside className="meeting-create-shell">
      <div className="create-flow-sidebar" aria-label="会议流程摘要">
        <div className="create-flow-sidebar__intro">
          <span>Meeting Flow</span>
          <strong>{formState.title || "新会议流程"}</strong>
          <p>{formState.meetingGoal || "定义目标、参会人、议程和执行条件。"}</p>
        </div>

        <div className="create-flow-score">
          <span>完成度</span>
          <strong>
            {completedStepCount}/{completionSteps.length}
          </strong>
          <div aria-hidden="true">
            {completionSteps.map((step) => (
              <i className={step.done ? "is-done" : ""} key={step.label} />
            ))}
          </div>
        </div>

        <div className="create-flow-meta">
          <div>
            <span>类型</span>
            <strong>{meetingTypeLabels[formState.type]}</strong>
          </div>
          <div>
            <span>优先级</span>
            <strong>{meetingPriorityLabels[formState.priority]}</strong>
          </div>
          <div>
            <span>渠道</span>
            <strong>{meetingChannelLabels[formState.channel]}</strong>
          </div>
          <div>
            <span>模式</span>
            <strong>{formState.isRecurring ? "重复会议" : "单次会议"}</strong>
          </div>
        </div>

        <div className="create-flow-preview">
          <span>流程草稿</span>
          <div className="create-flow-node is-ready">
            <i aria-hidden="true" />
            <div>
              <strong>会议申请</strong>
              <small>{formState.title || "等待标题"}</small>
            </div>
          </div>
          <div className="create-flow-node">
            <i aria-hidden="true" />
            <div>
              <strong>议程生成</strong>
              <small>{filledAgendaItems.length} 项议程</small>
            </div>
          </div>
          <div className="create-flow-node">
            <i aria-hidden="true" />
            <div>
              <strong>参与人同步</strong>
              <small>{namedParticipants.length} 位参会人</small>
            </div>
          </div>
        </div>
      </div>

      <form className="meeting-form meeting-form--create" onSubmit={onSubmit}>
        <div className="create-form-scroll scroll-area">
          <section className="meeting-form-section create-form-section">
            <div className="meeting-form-section__header create-form-section__header">
              <span>01</span>
              <div>
                <strong>会议对象</strong>
                <small>{meetingTypeLabels[formState.type]} / {meetingPriorityLabels[formState.priority]}</small>
              </div>
            </div>
            <div className="meeting-form-grid">
              <label className="form-field--full">
                <span>会议标题</span>
                <input
                  value={formState.title}
                  onChange={(event) => onFieldChange("title", event.target.value)}
                  placeholder="例如：项目周会 / 客户复盘沟通会"
                  required
                />
              </label>
              <label>
                <span>会议类型</span>
                <Dropdown
                  onChange={(value) => onFieldChange("type", value as CreateMeetingInput["type"])}
                  options={meetingTypeValues.map((type) => ({
                    label: meetingTypeLabels[type],
                    value: type
                  }))}
                  value={formState.type}
                />
              </label>
              <label>
                <span>优先级</span>
                <Dropdown
                  onChange={(value) => onFieldChange("priority", value as CreateMeetingInput["priority"])}
                  options={meetingPriorityValues.map((priority) => ({
                    label: meetingPriorityLabels[priority],
                    value: priority
                  }))}
                  value={formState.priority}
                />
              </label>
              <label>
                <span>组织者</span>
                <input
                  value={formState.host}
                  onChange={(event) => onFieldChange("host", event.target.value)}
                  placeholder="输入组织者 / 主持人"
                  required
                />
              </label>
              <label>
                <span>记录人</span>
                <input
                  value={formState.owner}
                  onChange={(event) => onFieldChange("owner", event.target.value)}
                  placeholder="输入记录人 / 负责人"
                  required
                />
              </label>
              <label className="form-field--full">
                <span>会议描述</span>
                <textarea
                  value={formState.description}
                  onChange={(event) => onFieldChange("description", event.target.value)}
                  placeholder="说明这场会议的背景、上下文或预期讨论内容"
                  rows={3}
                  required
                />
              </label>
              <label className="form-field--full">
                <span>会议目标</span>
                <textarea
                  value={formState.meetingGoal}
                  onChange={(event) => onFieldChange("meetingGoal", event.target.value)}
                  placeholder="例如：明确里程碑、形成决策、拆分后续行动项"
                  rows={3}
                  required
                />
              </label>
              <label className="form-field--full">
                <span>标签</span>
                <input
                  value={formState.tags.join(", ")}
                  onChange={(event) =>
                    onFieldChange(
                      "tags",
                      event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="多个标签请用逗号分隔，例如：周会, 研发, 高优先级"
                />
              </label>
            </div>
            {tags.length > 0 && (
              <div className="create-tag-preview" aria-label="标签预览">
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
          </section>

          <section className="meeting-form-section create-form-section">
            <div className="meeting-form-section__header create-form-section__header">
              <span>02</span>
              <div>
                <strong>时间与地点</strong>
                <small>{formState.startAt && formState.endAt ? "已设置排期" : "等待排期"}</small>
              </div>
            </div>
            <div className="meeting-form-grid">
              <label>
                <span>开始时间</span>
                <input
                  type="datetime-local"
                  value={formState.startAt}
                  onChange={(event) => onFieldChange("startAt", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>结束时间</span>
                <input
                  type="datetime-local"
                  value={formState.endAt}
                  onChange={(event) => onFieldChange("endAt", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>会议渠道</span>
                <Dropdown
                  onChange={(value) => onFieldChange("channel", value as CreateMeetingInput["channel"])}
                  options={meetingChannelValues.map((channel) => ({
                    label: meetingChannelLabels[channel],
                    value: channel
                  }))}
                  value={formState.channel}
                />
              </label>
              <label>
                <span>重复会议</span>
                <Dropdown
                  onChange={(value) => onFieldChange("isRecurring", value === "yes")}
                  options={[
                    { label: "否", value: "no" },
                    { label: "是", value: "yes" }
                  ]}
                  value={formState.isRecurring ? "yes" : "no"}
                />
              </label>
              <label className="form-field--full">
                <span>会议地点</span>
                <input
                  value={formState.location}
                  onChange={(event) => onFieldChange("location", event.target.value)}
                  placeholder="例如：上海 3F 大会议室"
                />
              </label>
              <label className="form-field--full">
                <span>在线会议链接</span>
                <input
                  value={formState.meetingLink}
                  onChange={(event) => onFieldChange("meetingLink", event.target.value)}
                  placeholder="例如：https://teams.microsoft.com/..."
                />
              </label>
              {formState.isRecurring && (
                <label className="form-field--full">
                  <span>重复规则</span>
                  <input
                    value={formState.recurrence}
                    onChange={(event) => onFieldChange("recurrence", event.target.value)}
                    placeholder="例如：每周一 09:30"
                  />
                </label>
              )}
            </div>
          </section>

          <section className="meeting-form-section create-form-section">
            <div className="meeting-form-section__header meeting-form-section__header--row create-form-section__header">
              <div className="create-form-section__title">
                <span>03</span>
                <div>
                  <strong>参会人</strong>
                  <small>{namedParticipants.length} 位已命名</small>
                </div>
              </div>
              <button className="ghost-button" onClick={onAddParticipant} type="button">
                添加参会人
              </button>
            </div>
            <div className="form-stack create-list">
              {formState.participants.map((participant, index) => (
                <div key={`participant-${index}`} className="editor-row create-person-row">
                  <b aria-hidden="true">{getInitials(participant.name, String(index + 1))}</b>
                  <input
                    value={participant.name}
                    onChange={(event) => onParticipantChange(index, "name", event.target.value)}
                    placeholder="姓名或团队"
                  />
                  <Dropdown
                    onChange={(value) => onParticipantChange(index, "role", value as MeetingParticipantInput["role"])}
                    options={participantRoleValues.map((role) => ({
                      label: participantRoleLabels[role],
                      value: role
                    }))}
                    value={participant.role}
                  />
                  <Dropdown
                    onChange={(value) =>
                      onParticipantChange(index, "status", value as MeetingParticipantInput["status"])
                    }
                    options={participantStatusValues.map((status) => ({
                      label: participantStatusLabels[status],
                      value: status
                    }))}
                    value={participant.status}
                  />
                  <button
                    aria-label={`删除参会人 ${index + 1}`}
                    className="ghost-button icon-button"
                    onClick={() => onRemoveParticipant(index)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="meeting-form-section create-form-section">
            <div className="meeting-form-section__header meeting-form-section__header--row create-form-section__header">
              <div className="create-form-section__title">
                <span>04</span>
                <div>
                  <strong>会议议程</strong>
                  <small>{filledAgendaItems.length} 项已填写</small>
                </div>
              </div>
              <button className="ghost-button" onClick={onAddAgendaItem} type="button">
                添加议程项
              </button>
            </div>
            <div className="form-stack create-list">
              {formState.agendaItems.map((item, index) => (
                <div key={`agenda-${index}`} className="editor-row editor-row--agenda create-agenda-row">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <input
                    value={item.title}
                    onChange={(event) => onAgendaItemChange(index, "title", event.target.value)}
                    placeholder="输入议程项，例如：风险同步"
                  />
                  <label className="inline-check create-check">
                    <input
                      checked={item.completed}
                      onChange={(event) => onAgendaItemChange(index, "completed", event.target.checked)}
                      type="checkbox"
                    />
                    <span>已讨论</span>
                  </label>
                  <button
                    aria-label={`删除议程 ${index + 1}`}
                    className="ghost-button icon-button"
                    onClick={() => onRemoveAgendaItem(index)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="meeting-form-section create-form-section">
            <div className="meeting-form-section__header create-form-section__header">
              <span>05</span>
              <div>
                <strong>会前备注</strong>
                <small>{formState.notes ? "已填写" : "可选"}</small>
              </div>
            </div>
            <div className="meeting-form-grid">
              <label className="form-field--full">
                <span>备注</span>
                <textarea
                  value={formState.notes}
                  onChange={(event) => onFieldChange("notes", event.target.value)}
                  placeholder="补充会前提醒、准备材料、审批说明等"
                  rows={3}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="form-actions form-actions--sticky">
          <div>
            <span>创建后状态</span>
            <strong>{completedStepCount === completionSteps.length ? "可提交审批" : "草稿待补全"}</strong>
          </div>
          <button className="secondary-button" disabled={isSubmitting} type="submit" value="save">
            {isSubmitting ? "保存中..." : "保存草稿"}
          </button>
          <button className="primary-button" disabled={isSubmitting} type="submit" value="submit">
            {isSubmitting ? "提交中..." : "提交申请"}
          </button>
        </div>
      </form>
    </aside>
  );
}

import { useEffect, useState } from "react";
import {
  actionItemStatusLabels,
  actionItemStatusValues,
  meetingChannelLabels,
  meetingPriorityLabels,
  meetingPriorityValues,
  meetingStatusLabels,
  meetingStatusValues,
  meetingTypeLabels,
  meetingTypeValues,
  participantRoleLabels,
  participantRoleValues,
  participantStatusLabels,
  participantStatusValues,
  type MeetingActionItemInput,
  type MeetingAgendaItemInput,
  type MeetingParticipantInput,
  type MeetingRecordWithPermissions,
  type MeetingStatus,
  type UpdateMeetingInput
} from "@meeting-flow/shared";
import { durationLabel, formatDateRange } from "../../lib/format";
import { ConfirmDialog } from "../common/PromptDialogs";
import { Dropdown } from "../common/Dropdown";
import { SelectableCardList } from "../common/SelectableCardList";

type MeetingDetailPanelProps = {
  isMutating: boolean;
  meeting: MeetingRecordWithPermissions | null;
  editableMeeting: UpdateMeetingInput | null;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  onSaveMeeting: (meetingId: string, input: UpdateMeetingInput) => Promise<boolean>;
  onUpdateStatus: (status: MeetingStatus) => Promise<boolean>;
  onCancelMeeting: () => Promise<boolean>;
  onDeleteMeeting: () => Promise<boolean>;
};

function createParticipant(): MeetingParticipantInput {
  return {
    name: "",
    role: "attendee",
    status: "pending"
  };
}

function createAgendaItem(): MeetingAgendaItemInput {
  return {
    title: "",
    completed: false
  };
}

function createActionItem(): MeetingActionItemInput {
  return {
    content: "",
    owner: "",
    dueDate: "",
    status: "todo"
  };
}

export function MeetingDetailPanel({
  isMutating,
  meeting,
  editableMeeting,
  isEditing,
  onEditingChange,
  onSaveMeeting,
  onUpdateStatus,
  onCancelMeeting,
  onDeleteMeeting
}: MeetingDetailPanelProps) {
  const [draft, setDraft] = useState<UpdateMeetingInput | null>(editableMeeting);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "delete" | null>(null);

  useEffect(() => {
    setDraft(editableMeeting);
  }, [editableMeeting, meeting?.id]);

  if (!meeting || !draft) {
    return (
      <aside className="glass-panel detail-panel panel-card panel-card--detail">
        <div className="section-head">
          <span>会议</span>
          <strong>请选择一场会议</strong>
          <p>从顶栏或会议页选择一场会议后，可查看详情并继续维护。</p>
        </div>
        <div className="empty-state">当前没有选中的会议</div>
      </aside>
    );
  }

  const activeMeeting = meeting;
  const activeDraft = draft;

  function updateDraft<Key extends keyof UpdateMeetingInput>(key: Key, value: UpdateMeetingInput[Key]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateParticipant(
    index: number,
    key: keyof MeetingParticipantInput,
    value: MeetingParticipantInput[keyof MeetingParticipantInput]
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            participants: current.participants.map((participant, participantIndex) =>
              participantIndex === index ? { ...participant, [key]: value } : participant
            )
          }
        : current
    );
  }

  function updateAgenda(
    index: number,
    key: keyof MeetingAgendaItemInput,
    value: MeetingAgendaItemInput[keyof MeetingAgendaItemInput]
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            agendaItems: current.agendaItems.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            )
          }
        : current
    );
  }

  function updateActionItem(
    index: number,
    key: keyof MeetingActionItemInput,
    value: MeetingActionItemInput[keyof MeetingActionItemInput]
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            actionItems: current.actionItems.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item
            )
          }
        : current
    );
  }

  function moveAgendaItem(index: number, direction: -1 | 1) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.agendaItems.length) {
        return current;
      }

      const agendaItems = [...current.agendaItems];
      [agendaItems[index], agendaItems[targetIndex]] = [agendaItems[targetIndex], agendaItems[index]];

      return {
        ...current,
        agendaItems
      };
    });
  }

  async function handleSave() {
    const success = await onSaveMeeting(activeMeeting.id, activeDraft);
    if (success) {
      onEditingChange(false);
    }
  }

  function handleDiscardEdits() {
    setDraft(editableMeeting);
    onEditingChange(false);
  }

  async function handleToggleAgenda(index: number) {
    const nextAgendaItems = activeDraft.agendaItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, completed: !item.completed } : item
    );
    const success = await onSaveMeeting(activeMeeting.id, {
      ...activeDraft,
      agendaItems: nextAgendaItems
    });

    if (success) {
      setDraft((current) => (current ? { ...current, agendaItems: nextAgendaItems } : current));
    }
  }

  async function handleToggleNotification(kind: keyof UpdateMeetingInput["notifications"]) {
    const nextNotifications = {
      ...activeDraft.notifications,
      [kind]: !activeDraft.notifications[kind]
    };
    const success = await onSaveMeeting(activeMeeting.id, {
      ...activeDraft,
      notifications: nextNotifications
    });

    if (success) {
      setDraft((current) => (current ? { ...current, notifications: nextNotifications } : current));
    }
  }

  async function handleDelete() {
    setConfirmAction("delete");
  }

  async function handleCancelMeeting() {
    setConfirmAction("cancel");
  }

  async function handleConfirmAction() {
    const success = confirmAction === "delete" ? await onDeleteMeeting() : await onCancelMeeting();

    if (success) {
      setConfirmAction(null);
    }
  }

  const visibleAgendaItems = isEditing ? activeDraft.agendaItems : activeMeeting.agendaItems;
  const sentNotificationCount = Object.values(activeMeeting.notifications).filter(Boolean).length;
  const openActionItemCount = activeMeeting.actionItems.filter((item) => item.status !== "completed").length;
  const discussedAgendaCount = activeMeeting.agendaItems.filter((item) => item.completed).length;

  return (
    <>
    <aside className="meeting-detail detail-panel panel-card panel-card--detail">
      <div className="meeting-detail__header">
        <div className="meeting-detail__title">
          <span className={`status-badge status-badge--${activeMeeting.status}`}>
            {meetingStatusLabels[activeMeeting.status]}
          </span>
          <p>{activeMeeting.meetingGoal}</p>
        </div>
        <div className="meeting-detail__actions">
          {!isEditing ? (
            <button
              className="ghost-button"
              disabled={isMutating || !activeMeeting.permissions.canEdit}
              onClick={() => onEditingChange(true)}
              type="button"
            >
              编辑会议
            </button>
          ) : (
            <>
              <button className="secondary-button" disabled={isMutating} onClick={handleDiscardEdits} type="button">
                放弃修改
              </button>
              <button className="primary-button" disabled={isMutating} onClick={() => void handleSave()} type="button">
                保存修改
              </button>
            </>
          )}
        </div>
      </div>

      <div className="meeting-detail__summary detail-grid detail-grid--dense">
        <article>
          <span>会议时间</span>
          <strong>{formatDateRange(activeMeeting.startAt, activeMeeting.endAt)}</strong>
        </article>
        <article>
          <span>参会人</span>
          <strong>{activeMeeting.attendeeCount} 人 / {durationLabel(activeMeeting.durationMinutes)}</strong>
        </article>
        <article>
          <span>议程进度</span>
          <strong>{discussedAgendaCount} / {activeMeeting.agendaItems.length || 0} 已讨论</strong>
        </article>
        <article>
          <span>执行状态</span>
          <strong>{openActionItemCount} 项待办 / {sentNotificationCount} 项通知</strong>
        </article>
      </div>

      <div className="meeting-detail__content">
        <div className="meeting-detail__primary">
      <section className="detail-section">
        <div className="detail-section__header">
          <strong>基础信息</strong>
        </div>
        {isEditing ? (
          <div className="meeting-form-grid">
            <label className="form-field--full">
              <span>会议标题</span>
              <input value={activeDraft.title} onChange={(event) => updateDraft("title", event.target.value)} />
            </label>
            <label>
              <span>会议类型</span>
              <Dropdown
                onChange={(value) => updateDraft("type", value as UpdateMeetingInput["type"])}
                options={meetingTypeValues.map((type) => ({
                  label: meetingTypeLabels[type],
                  value: type
                }))}
                value={activeDraft.type}
              />
            </label>
            <label>
              <span>优先级</span>
              <Dropdown
                onChange={(value) => updateDraft("priority", value as UpdateMeetingInput["priority"])}
                options={meetingPriorityValues.map((priority) => ({
                  label: meetingPriorityLabels[priority],
                  value: priority
                }))}
                value={activeDraft.priority}
              />
            </label>
            <label>
              <span>开始时间</span>
              <input
                type="datetime-local"
                value={activeDraft.startAt.slice(0, 16)}
                onChange={(event) => updateDraft("startAt", event.target.value)}
              />
            </label>
            <label>
              <span>结束时间</span>
              <input
                type="datetime-local"
                value={activeDraft.endAt.slice(0, 16)}
                onChange={(event) => updateDraft("endAt", event.target.value)}
              />
            </label>
            <label>
              <span>组织者</span>
              <input value={activeDraft.host} onChange={(event) => updateDraft("host", event.target.value)} />
            </label>
            <label>
              <span>记录人</span>
              <input value={activeDraft.owner} onChange={(event) => updateDraft("owner", event.target.value)} />
            </label>
            <label>
              <span>会议渠道</span>
              <Dropdown
                onChange={(value) => updateDraft("channel", value as UpdateMeetingInput["channel"])}
                options={Object.entries(meetingChannelLabels).map(([value, label]) => ({
                  label,
                  value: value as UpdateMeetingInput["channel"]
                }))}
                value={activeDraft.channel}
              />
            </label>
            <label>
              <span>状态</span>
              <Dropdown
                onChange={(value) => updateDraft("status", value as UpdateMeetingInput["status"])}
                options={meetingStatusValues.map((status) => ({
                  label: meetingStatusLabels[status],
                  value: status
                }))}
                value={activeDraft.status}
              />
            </label>
            <label className="form-field--full">
              <span>地点</span>
              <input value={activeDraft.location} onChange={(event) => updateDraft("location", event.target.value)} />
            </label>
            <label className="form-field--full">
              <span>在线会议链接</span>
              <input value={activeDraft.meetingLink} onChange={(event) => updateDraft("meetingLink", event.target.value)} />
            </label>
            <label className="form-field--full">
              <span>标签</span>
              <input
                value={activeDraft.tags.join(", ")}
                onChange={(event) =>
                  updateDraft(
                    "tags",
                    event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
          </div>
        ) : (
          <div className="detail-field-grid">
            <article className="detail-field">
              <span>会议类型</span>
              <strong>{meetingTypeLabels[activeMeeting.type]}</strong>
            </article>
            <article className="detail-field">
              <span>优先级</span>
              <strong>{meetingPriorityLabels[activeMeeting.priority]}</strong>
            </article>
            <article className="detail-field">
              <span>会议渠道</span>
              <strong>{meetingChannelLabels[activeMeeting.channel]}</strong>
            </article>
            <article className="detail-field">
              <span>当前状态</span>
              <strong>{meetingStatusLabels[activeMeeting.status]}</strong>
            </article>
            <article className="detail-field">
              <span>组织者</span>
              <strong>{activeMeeting.host}</strong>
            </article>
            <article className="detail-field">
              <span>记录人</span>
              <strong>{activeMeeting.owner}</strong>
            </article>
            <article className="detail-field detail-field--full">
              <span>地点 / 在线会议</span>
              <strong>{activeMeeting.location || activeMeeting.meetingLink || "未设置"}</strong>
            </article>
            {activeMeeting.isRecurring && (
              <article className="detail-field detail-field--full">
                <span>重复规则</span>
                <strong>{activeMeeting.recurrence || "未设置"}</strong>
              </article>
            )}
            <article className="detail-field detail-field--full">
              <span>标签</span>
              <div className="pill-list">
                {activeMeeting.tags.length > 0 ? (
                  activeMeeting.tags.map((tag) => (
                    <span key={tag} className="pill">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="empty-inline">暂无标签</span>
                )}
              </div>
            </article>
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <strong>描述与目标</strong>
        </div>
        {isEditing ? (
          <div className="meeting-form-grid">
            <label className="form-field--full">
              <span>会议描述</span>
              <textarea
                value={activeDraft.description}
                onChange={(event) => updateDraft("description", event.target.value)}
                rows={3}
              />
            </label>
            <label className="form-field--full">
              <span>会议目标</span>
              <textarea
                value={activeDraft.meetingGoal}
                onChange={(event) => updateDraft("meetingGoal", event.target.value)}
                rows={3}
              />
            </label>
          </div>
        ) : (
          <div className="detail-card-stack">
            <article className="detail-card">
              <span>会议描述</span>
              <p>{activeMeeting.description}</p>
            </article>
            <article className="detail-card">
              <span>会议目标</span>
              <p>{activeMeeting.meetingGoal}</p>
            </article>
          </div>
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header detail-section__header--row">
          <div>
            <strong>议程</strong>
          </div>
          {isEditing && (
            <button
              className="ghost-button"
              onClick={() => updateDraft("agendaItems", [...activeDraft.agendaItems, createAgendaItem()])}
              type="button"
            >
              添加议程项
            </button>
          )}
        </div>
        <div className="agenda-list">
          {isEditing ? (
            <>
              {visibleAgendaItems.map((item, index) => (
                <div key={`${item.title}-${index}`} className="agenda-item">
                  <input value={item.title} onChange={(event) => updateAgenda(index, "title", event.target.value)} />
                  <label className="inline-check">
                    <input
                      checked={item.completed}
                      onChange={(event) => updateAgenda(index, "completed", event.target.checked)}
                      type="checkbox"
                    />
                    <span>已讨论</span>
                  </label>
                  <div className="row-actions">
                    <button className="ghost-button" onClick={() => moveAgendaItem(index, -1)} type="button">
                      上移
                    </button>
                    <button className="ghost-button" onClick={() => moveAgendaItem(index, 1)} type="button">
                      下移
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        updateDraft(
                          "agendaItems",
                          activeDraft.agendaItems.filter((_, agendaIndex) => agendaIndex !== index)
                        )
                      }
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {visibleAgendaItems.length === 0 && <div className="empty-inline">暂无议程项</div>}
            </>
          ) : (
            <SelectableCardList
              ariaLabel="议程"
              empty={<div className="empty-inline">暂无议程项</div>}
              items={visibleAgendaItems.map((item, index) => ({
                id: `agenda-${index}`,
                title: item.title,
                className: item.completed ? "is-done" : "",
                actions: (
                  <button
                    className={`toggle-mark${item.completed ? " is-done" : ""}`}
                    disabled={isMutating}
                    onClick={() => void handleToggleAgenda(index)}
                    type="button"
                  >
                    {item.completed ? "已讨论" : "待讨论"}
                  </button>
                )
              }))}
              layout="stack"
            />
          )}
        </div>
      </section>

        </div>
        <aside className="meeting-detail__secondary">
      <section className="detail-section">
        <div className="detail-section__header detail-section__header--row">
          <div>
            <strong>参会人</strong>
          </div>
          {isEditing && (
            <button
              className="ghost-button"
              onClick={() => updateDraft("participants", [...activeDraft.participants, createParticipant()])}
              type="button"
            >
              添加参会人
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="form-stack">
            {activeDraft.participants.map((participant, index) => (
              <div key={`detail-participant-${index}`} className="editor-row">
                <input
                  value={participant.name}
                  onChange={(event) => updateParticipant(index, "name", event.target.value)}
                  placeholder="参会人姓名"
                />
                <Dropdown
                  onChange={(value) => updateParticipant(index, "role", value as MeetingParticipantInput["role"])}
                  options={participantRoleValues.map((role) => ({
                    label: participantRoleLabels[role],
                    value: role
                  }))}
                  value={participant.role}
                />
                <Dropdown
                  onChange={(value) => updateParticipant(index, "status", value as MeetingParticipantInput["status"])}
                  options={participantStatusValues.map((status) => ({
                    label: participantStatusLabels[status],
                    value: status
                  }))}
                  value={participant.status}
                />
                <button
                  className="ghost-button"
                  onClick={() =>
                    updateDraft(
                      "participants",
                      activeDraft.participants.filter((_, participantIndex) => participantIndex !== index)
                    )
                  }
                  type="button"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <SelectableCardList
            ariaLabel="参会人"
            empty={<div className="empty-inline">暂无参会人</div>}
            items={activeMeeting.participants.map((participant) => ({
              id: participant.id,
              title: participant.name,
              badge: participantStatusLabels[participant.status],
              meta: participantRoleLabels[participant.role]
            }))}
            layout="stack"
          />
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <strong>通知</strong>
        </div>
        <div className="notification-grid">
          <button
            className={`ghost-button${activeMeeting.notifications.inviteSent ? " is-active" : ""}`}
            disabled={isMutating || isEditing}
            onClick={() => void handleToggleNotification("inviteSent")}
            type="button"
          >
            {activeMeeting.notifications.inviteSent ? "已发送会议通知" : "发送会议通知"}
          </button>
          <button
            className={`ghost-button${activeMeeting.notifications.reminderSent ? " is-active" : ""}`}
            disabled={isMutating || isEditing}
            onClick={() => void handleToggleNotification("reminderSent")}
            type="button"
          >
            {activeMeeting.notifications.reminderSent ? "已发送会前提醒" : "发送会前提醒"}
          </button>
          <button
            className={`ghost-button${activeMeeting.notifications.changeNotified ? " is-active" : ""}`}
            disabled={isMutating || isEditing}
            onClick={() => void handleToggleNotification("changeNotified")}
            type="button"
          >
            {activeMeeting.notifications.changeNotified ? "已发送变更通知" : "发送变更通知"}
          </button>
        </div>
      </section>

      <section className="detail-section">
        <div className="detail-section__header">
          <strong>纪要</strong>
        </div>
        {isEditing ? (
          <textarea value={activeDraft.minutes} onChange={(event) => updateDraft("minutes", event.target.value)} rows={4} />
        ) : (
          <article className="detail-card">
            <span>纪要内容</span>
            <p>{activeMeeting.permissions.canViewMinutes ? activeMeeting.minutes || "暂无会议纪要" : "当前无权查看会议纪要"}</p>
          </article>
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header detail-section__header--row">
          <div>
            <strong>待办</strong>
          </div>
          {isEditing && (
            <button
              className="ghost-button"
              onClick={() => updateDraft("actionItems", [...activeDraft.actionItems, createActionItem()])}
              type="button"
            >
              添加待办
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="form-stack">
            {activeDraft.actionItems.map((item, index) => (
              <div key={`action-${index}`} className="editor-row editor-row--action">
                <input
                  value={item.content}
                  onChange={(event) => updateActionItem(index, "content", event.target.value)}
                  placeholder="待办内容"
                />
                <input
                  value={item.owner}
                  onChange={(event) => updateActionItem(index, "owner", event.target.value)}
                  placeholder="负责人"
                />
                <input
                  type="date"
                  value={item.dueDate}
                  onChange={(event) => updateActionItem(index, "dueDate", event.target.value)}
                />
                <Dropdown
                  onChange={(value) => updateActionItem(index, "status", value as MeetingActionItemInput["status"])}
                  options={actionItemStatusValues.map((status) => ({
                    label: actionItemStatusLabels[status],
                    value: status
                  }))}
                  value={item.status}
                />
                <button
                  className="ghost-button"
                  onClick={() =>
                    updateDraft(
                      "actionItems",
                      activeDraft.actionItems.filter((_, actionIndex) => actionIndex !== index)
                    )
                  }
                  type="button"
                >
                  删除
                </button>
              </div>
            ))}
            {activeDraft.actionItems.length === 0 && <div className="empty-inline">暂无待办事项</div>}
          </div>
        ) : (
          <SelectableCardList
            ariaLabel="待办"
            empty={<div className="empty-inline">暂无待办事项</div>}
            items={activeMeeting.actionItems.map((item) => ({
              id: item.id,
              title: item.content,
              badge: actionItemStatusLabels[item.status],
              meta: `负责人：${item.owner} · 截止日期：${item.dueDate || "未设置"}`,
              className: "selectable-card--title-clamp"
            }))}
            layout="stack"
          />
        )}
      </section>

      <section className="detail-section">
        <div className="detail-section__header detail-section__header--row">
          <div>
            <strong>状态与权限</strong>
          </div>
          <div className="permissions-note">
            <span>创建 {activeMeeting.permissions.canCreate ? "可用" : "受限"}</span>
            <span>编辑 {activeMeeting.permissions.canEdit ? "可用" : "受限"}</span>
            <span>取消 {activeMeeting.permissions.canCancel ? "可用" : "受限"}</span>
            <span>删除 {activeMeeting.permissions.canDelete ? "可用" : "受限"}</span>
          </div>
        </div>
        <div className="status-actions__buttons">
          {meetingStatusValues.map((status) => (
            <button
              key={status}
              className={`ghost-button${activeMeeting.status === status ? " is-active" : ""}`}
              disabled={isMutating || activeMeeting.status === status}
              onClick={() => void onUpdateStatus(status)}
              type="button"
            >
              {meetingStatusLabels[status]}
            </button>
          ))}
        </div>
        <div className="danger-zone">
          <button
            className="secondary-button"
            disabled={isMutating || !activeMeeting.permissions.canCancel}
            onClick={() => void handleCancelMeeting()}
            type="button"
          >
            取消会议
          </button>
          <button
            className="danger-button"
            disabled={isMutating || !activeMeeting.permissions.canDelete}
            onClick={() => void handleDelete()}
            type="button"
          >
            删除会议
          </button>
        </div>
      </section>
        </aside>
      </div>
    </aside>
    {confirmAction && (
      <ConfirmDialog
        confirmLabel={confirmAction === "delete" ? "删除会议" : "取消会议"}
        description={
          confirmAction === "delete"
            ? `确认删除会议“${activeMeeting.title}”吗？此操作无法撤销。`
            : `确认取消会议“${activeMeeting.title}”吗？会议记录会保留，但状态将变为已取消。`
        }
        isLoading={isMutating}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmAction === "delete" ? "删除会议" : "取消会议"}
        tone="danger"
      />
    )}
    </>
  );
}

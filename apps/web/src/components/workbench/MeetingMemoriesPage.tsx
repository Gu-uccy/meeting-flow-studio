import { useMemo, useState } from "react";
import {
  meetingMemoryKindLabels,
  meetingMemoryKindValues,
  type MeetingMemory,
  type MeetingMemoryKind,
  type MeetingMemoryVisibility,
  type MeetingRecordWithPermissions
} from "@meeting-flow/shared";
import { formatDateTime } from "../../lib/format";
import { Dropdown } from "../common/Dropdown";
import { SelectableCardList } from "../common/SelectableCardList";
import { MeetingReadOnlyBanner } from "./layout/MeetingReadOnlyBanner";
import { MeetingWorkspaceLayout } from "./layout/MeetingWorkspaceLayout";

const visibilityLabels: Record<MeetingMemoryVisibility, string> = {
  private: "仅自己",
  team: "团队",
  organization: "组织"
};

const visibilityValues = Object.keys(visibilityLabels) as MeetingMemoryVisibility[];

type KindFilter = "all" | MeetingMemoryKind;

type MeetingMemoriesPageProps = {
  hint?: string | null;
  isBusy?: boolean;
  isLoading: boolean;
  isMutating: boolean;
  meeting: MeetingRecordWithPermissions | null;
  memories: MeetingMemory[];
  memoryError?: string;
  onCreateMemory: (input: {
    content: string;
    kind?: MeetingMemoryKind;
    visibility?: MeetingMemoryVisibility;
    isPinned?: boolean;
  }) => Promise<MeetingMemory | null>;
  onDeleteMemory: (memoryId: string) => Promise<boolean>;
  onReload: () => void;
  onUpdateMemory: (
    memoryId: string,
    patch: Partial<Pick<MeetingMemory, "content" | "kind" | "visibility" | "isPinned">>
  ) => Promise<MeetingMemory | null>;
  readOnly?: boolean;
};

export function MeetingMemoriesPage({
  hint,
  isBusy = false,
  isLoading,
  isMutating,
  meeting,
  memories,
  memoryError = "",
  onCreateMemory,
  onDeleteMemory,
  onReload,
  onUpdateMemory,
  readOnly = false
}: MeetingMemoriesPageProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftKind, setDraftKind] = useState<MeetingMemoryKind>("preference");
  const [draftVisibility, setDraftVisibility] = useState<MeetingMemoryVisibility>("team");
  const busy = isBusy || isMutating;

  const filteredMemories = useMemo(
    () => (kindFilter === "all" ? memories : memories.filter((memory) => memory.kind === kindFilter)),
    [kindFilter, memories]
  );

  const selectedMemory = useMemo(
    () => filteredMemories.find((memory) => memory.id === selectedId) ?? filteredMemories[0] ?? null,
    [filteredMemories, selectedId]
  );

  const memoryCards = useMemo(
    () =>
      filteredMemories.map((memory) => ({
        id: memory.id,
        title: memory.content,
        badge: meetingMemoryKindLabels[memory.kind],
        meta: formatDateTime(memory.updatedAt),
        className: ["selectable-card--title-clamp", memory.isPinned ? "is-pinned" : ""].filter(Boolean).join(" ")
      })),
    [filteredMemories]
  );

  const pinnedCount = memories.filter((memory) => memory.isPinned).length;
  const kindCounts = useMemo(() => {
    const counts = Object.fromEntries(meetingMemoryKindValues.map((kind) => [kind, 0])) as Record<MeetingMemoryKind, number>;
    for (const memory of memories) {
      counts[memory.kind] += 1;
    }
    return counts;
  }, [memories]);

  async function handleCreate() {
    const content = draftContent.trim();
    if (!content || busy) {
      return;
    }

    const created = await onCreateMemory({
      content,
      kind: draftKind,
      visibility: draftVisibility
    });
    if (!created) {
      return;
    }

    setDraftContent("");
    setSelectedId(created.id);
    setKindFilter("all");
  }

  if (!meeting) {
    return (
      <MeetingWorkspaceLayout hint={hint}>
        <section className="workbench-empty workbench-empty--canvas" aria-label="会议记忆">
          <h2>选择会议查看记忆</h2>
          <p>从顶栏选择会议后，可查看流程沉淀的经验，或手工补充一条记忆。</p>
        </section>
      </MeetingWorkspaceLayout>
    );
  }

  return (
    <MeetingWorkspaceLayout hint={hint}>
      <section className={`memory-page${readOnly ? " memory-page--readonly" : ""}`} aria-label="会议记忆">
        <MeetingReadOnlyBanner meeting={meeting} />

        <header className="memory-page__header">
          <div className="memory-page__header-copy">
            <strong>{meeting.title}</strong>
            <p>{isLoading ? "记忆同步中…" : `${memories.length} 条经验记录`}</p>
          </div>
          <div className="memory-page__header-actions">
            <button className="ghost-button" disabled={busy || isLoading} onClick={onReload} type="button">
              {isLoading ? "刷新中..." : "刷新"}
            </button>
          </div>
        </header>

        <div className="memory-page__meta" aria-label="记忆指标">
          <span>
            全部 <strong>{memories.length}</strong>
          </span>
          <span>
            置顶 <strong>{pinnedCount}</strong>
          </span>
          {meetingMemoryKindValues.map((kind) =>
            kindCounts[kind] > 0 ? (
              <span key={kind}>
                {meetingMemoryKindLabels[kind]} <strong>{kindCounts[kind]}</strong>
              </span>
            ) : null
          )}
        </div>

        {memoryError ? <p className="memory-page__feedback">{memoryError}</p> : null}

        <div className="memory-page__filters" aria-label="按类型筛选">
          <button
            className={`filter-chip${kindFilter === "all" ? " is-active" : ""}`}
            onClick={() => setKindFilter("all")}
            type="button"
          >
            全部
          </button>
          {meetingMemoryKindValues.map((kind) => (
            <button
              className={`filter-chip${kindFilter === kind ? " is-active" : ""}`}
              key={kind}
              onClick={() => setKindFilter(kind)}
              type="button"
            >
              {meetingMemoryKindLabels[kind]}
            </button>
          ))}
        </div>

        <div className="memory-page__body">
          <aside className="memory-page__list" aria-label="记忆列表">
            {!readOnly ? (
              <section className="memory-page__create" aria-label="新建记忆">
                <div className="memory-page__create-title">
                  <strong>手工新建</strong>
                  <span>补充流程未沉淀的经验</span>
                </div>
                <label className="memory-page__field">
                  <span>内容</span>
                  <textarea
                    disabled={busy}
                    onChange={(event) => setDraftContent(event.target.value)}
                    placeholder="例如：客户偏好周五下午开会"
                    rows={3}
                    value={draftContent}
                  />
                </label>
                <div className="memory-page__create-row">
                  <label className="memory-page__field">
                    <span>类型</span>
                    <Dropdown
                      ariaLabel="记忆类型"
                      onChange={(value) => setDraftKind(value as MeetingMemoryKind)}
                      options={meetingMemoryKindValues.map((kind) => ({
                        label: meetingMemoryKindLabels[kind],
                        value: kind
                      }))}
                      value={draftKind}
                    />
                  </label>
                  <label className="memory-page__field">
                    <span>可见范围</span>
                    <Dropdown
                      ariaLabel="可见范围"
                      onChange={(value) => setDraftVisibility(value as MeetingMemoryVisibility)}
                      options={visibilityValues.map((value) => ({
                        label: visibilityLabels[value],
                        value
                      }))}
                      value={draftVisibility}
                    />
                  </label>
                </div>
                <button
                  className="primary-button"
                  disabled={busy || !draftContent.trim()}
                  onClick={() => void handleCreate()}
                  type="button"
                >
                  {isMutating ? "创建中..." : "创建记忆"}
                </button>
              </section>
            ) : null}

            <div className="memory-page__rows scroll-area">
              <SelectableCardList
                ariaLabel="记忆条目"
                className="memory-page__card-list"
                empty={
                  isLoading && memories.length === 0 ? (
                    <p className="memory-page__empty">加载记忆中…</p>
                  ) : (
                    <p className="memory-page__empty">
                      {memories.length === 0
                        ? readOnly
                          ? "暂无记忆。完成流程后会自动沉淀经验。"
                          : "暂无记忆。可在上方手工新建，或完成流程后自动沉淀。"
                        : "当前类型下暂无记忆。"}
                    </p>
                  )
                }
                items={memoryCards}
                layout="stack"
                onSelect={setSelectedId}
                selectedId={selectedMemory?.id ?? null}
              />
            </div>
          </aside>

          <section className="memory-page__detail" aria-label="记忆详情">
            {selectedMemory ? (
              <>
                <header className="memory-page__detail-head">
                  <div>
                    <strong>{meetingMemoryKindLabels[selectedMemory.kind]}</strong>
                    <span>
                      {selectedMemory.isPinned ? "已置顶 · " : ""}
                      {visibilityLabels[selectedMemory.visibility]} · 置信度 {(selectedMemory.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {!readOnly ? (
                    <div className="memory-page__detail-actions">
                      <button
                        className="ghost-button"
                        disabled={busy}
                        onClick={() => void onUpdateMemory(selectedMemory.id, { isPinned: !selectedMemory.isPinned })}
                        type="button"
                      >
                        {selectedMemory.isPinned ? "取消置顶" : "置顶"}
                      </button>
                      <button
                        className="danger-button"
                        disabled={busy}
                        onClick={() =>
                          void onDeleteMemory(selectedMemory.id).then((ok) => {
                            if (ok && selectedId === selectedMemory.id) {
                              setSelectedId("");
                            }
                          })
                        }
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  ) : null}
                </header>

                <div className="memory-page__detail-body scroll-area">
                  <p>{selectedMemory.content}</p>
                  <dl className="memory-page__detail-meta">
                    <div>
                      <dt>更新时间</dt>
                      <dd>{formatDateTime(selectedMemory.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>创建时间</dt>
                      <dd>{formatDateTime(selectedMemory.createdAt)}</dd>
                    </div>
                    {selectedMemory.source ? (
                      <div>
                        <dt>来源</dt>
                        <dd>{selectedMemory.source}</dd>
                      </div>
                    ) : null}
                    {selectedMemory.tags.length > 0 ? (
                      <div>
                        <dt>标签</dt>
                        <dd>{selectedMemory.tags.join("、")}</dd>
                      </div>
                    ) : null}
                    {selectedMemory.relatedParticipantNames.length > 0 ? (
                      <div>
                        <dt>相关人</dt>
                        <dd>{selectedMemory.relatedParticipantNames.join("、")}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </>
            ) : (
              <p className="memory-page__empty">选择一条记忆查看详情。</p>
            )}
          </section>
        </div>
      </section>
    </MeetingWorkspaceLayout>
  );
}

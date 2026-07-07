import { useState } from "react";
import {
  actionItemStatusLabels,
  meetingMemoryKindLabels,
  type MeetingMemory,
  type MeetingRecord,
  type ProductNodeRun,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import { useKnowledgeSearch } from "../../hooks/useKnowledgeSearch";
import { useKnowledgeIndex } from "../../hooks/useKnowledgeIndex";
import { useKnowledgeDocuments } from "../../hooks/useKnowledgeDocuments";
import { RunLatencyWaterfall } from "./RunLatencyWaterfall";
import { nodeRunLabels, runStatusLabels } from "./workflowPanelUtils";
import { WorkflowSideTabs, workflowDetailTabs, type WorkflowDetailTab } from "./WorkflowSideTabs";

type WorkflowSupportPanelProps = {
  blockedNodeRun?: ProductNodeRun;
  isMemoryLoading: boolean;
  isMemoryMutating: boolean;
  isWorkflowActionBusy: boolean;
  meetingMemories: MeetingMemory[];
  memoryError: string;
  onDeleteMemory: (memoryId: string) => Promise<boolean>;
  onUpdateMemory: (
    memoryId: string,
    patch: Partial<Pick<MeetingMemory, "content" | "kind" | "visibility" | "isPinned">>
  ) => Promise<MeetingMemory | null>;
  onAdvanceWorkflowRun: () => void;
  onCancelWorkflowRun: () => void;
  onEditMeeting: () => void;
  onOpenDetail: () => void;
  onOpenRunDetail: () => void;
  onRetryWorkflowRun: () => void;
  onStartWorkflowRun: () => void;
  onUpdateStatus: (status: MeetingRecord["status"]) => Promise<boolean>;
  resolutionNote: string;
  selectedFlowNodeId: string;
  selectedInputPayload: Array<{ key: string; value: string }>;
  selectedMeeting: MeetingRecord | null;
  selectedNode: { id: string; title: string } | null;
  selectedNodeRun?: ProductNodeRun;
  selectedOutputPayload: Array<{ key: string; value: string }>;
  selectedRun: ProductWorkflowRun | null;
  selectedTemplate: ProductWorkflowTemplate;
  setResolutionNote: (value: string) => void;
  setSelectedFlowNodeId: (nodeId: string) => void;
  nextMeetingStatus: { label: string; value: MeetingRecord["status"] } | null;
  workflowFeedback: string;
};

export function WorkflowSupportPanel(props: WorkflowSupportPanelProps) {
  const {
    blockedNodeRun,
    isMemoryLoading,
    isMemoryMutating,
    isWorkflowActionBusy,
    meetingMemories,
    memoryError,
    onDeleteMemory,
    onUpdateMemory,
    nextMeetingStatus,
    onAdvanceWorkflowRun,
    onCancelWorkflowRun,
    onEditMeeting,
    onOpenDetail,
    onOpenRunDetail,
    onRetryWorkflowRun,
    onStartWorkflowRun,
    onUpdateStatus,
    resolutionNote,
    selectedFlowNodeId,
    selectedInputPayload,
    selectedMeeting,
    selectedNode,
    selectedNodeRun,
    selectedOutputPayload,
    selectedRun,
    selectedTemplate,
    setResolutionNote,
    setSelectedFlowNodeId,
    workflowFeedback
  } = props;

  const [activeTab, setActiveTab] = useState<WorkflowDetailTab>("run");
  const knowledgeSearch = useKnowledgeSearch(selectedMeeting?.id ?? "", Boolean(selectedMeeting));
  const knowledgeIndex = useKnowledgeIndex(activeTab === "memory");
  const knowledgeDocuments = useKnowledgeDocuments(selectedMeeting?.id ?? "", activeTab === "memory" && Boolean(selectedMeeting));
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentContent, setDocumentContent] = useState("");

  const runSummary = selectedRun
    ? `${runStatusLabels[selectedRun.status]} · ${selectedRun.durationSeconds}s${selectedRun.usage?.totalTokens ? ` · ${selectedRun.usage.totalTokens} tokens` : ""}`
    : "尚未运行";

  return (
    <div className="workflow-support-panel workflow-support-panel--tabbed" aria-label="流程侧栏">
      <WorkflowSideTabs activeTab={activeTab} ariaLabel="详情面板视图" onChange={setActiveTab} tabs={workflowDetailTabs} />

      {activeTab === "run" && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">当前模板</span>
            <strong>{selectedTemplate.name}</strong>
            <p>{runSummary}</p>
          </div>

          {selectedNode && (
            <div className="workflow-side-panel__node" aria-label="当前节点">
              <div className="workflow-side-panel__node-head">
                <strong>{selectedNode.title}</strong>
                <span>{selectedNodeRun ? nodeRunLabels[selectedNodeRun.status] : "未运行"}</span>
              </div>
              {selectedNodeRun?.errorMessage && (
                <p className="workflow-side-panel__error">{selectedNodeRun.errorMessage}</p>
              )}
              {(selectedInputPayload.length > 0 || selectedOutputPayload.length > 0) && (
                <details className="workflow-side-panel__payload">
                  <summary>节点输入输出</summary>
                  <div>
                    {selectedInputPayload.map((item) => (
                      <code key={`in-${item.key}`}>{item.key}: {item.value}</code>
                    ))}
                    {selectedOutputPayload.map((item) => (
                      <code key={`out-${item.key}`}>{item.key}: {item.value}</code>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          <section className="workflow-side-panel__logs" aria-label="运行日志">
            <div className="ide-section-title">
              <strong>运行日志</strong>
              <span>{selectedRun ? `${selectedRun.logs.length} 条` : "暂无"}</span>
            </div>
            {selectedRun?.usage && selectedRun.usage.totalTokens > 0 ? (
              <p className="workflow-side-panel__usage">
                Token 用量：输入 {selectedRun.usage.inputTokens} / 输出 {selectedRun.usage.outputTokens} / 合计 {selectedRun.usage.totalTokens}
              </p>
            ) : null}
            {selectedRun ? (
              <RunLatencyWaterfall run={selectedRun} template={selectedTemplate} variant="compact" />
            ) : null}
            {selectedRun ? (
              selectedRun.logs.slice(-6).map((log) => (
                <button
                  className={`ide-run-log__row ide-run-log__row--${log.level}${log.nodeId === selectedFlowNodeId ? " is-active" : ""}`}
                  disabled={!log.nodeId}
                  key={log.id}
                  onClick={() => { if (log.nodeId) setSelectedFlowNodeId(log.nodeId); }}
                  type="button"
                >
                  <span>{log.time}</span>
                  <code>{log.message}</code>
                </button>
              ))
            ) : (
              <p className="memory-empty">选择会议后点击「启动流程」开始第一次运行。</p>
            )}
          </section>

          {blockedNodeRun && (
            <textarea
              aria-label="阻塞处理说明"
              className="workflow-side-panel__note"
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder="记录阻塞处理说明，便于继续流程"
              value={resolutionNote}
            />
          )}

          <div className="workflow-side-panel__actions">
            <button
              className="primary-button workflow-side-panel__primary"
              disabled={!selectedMeeting || !selectedTemplate || isWorkflowActionBusy}
              onClick={() => void (blockedNodeRun ? onAdvanceWorkflowRun() : onStartWorkflowRun())}
              type="button"
            >
              {blockedNodeRun ? "处理阻塞并继续" : "启动流程"}
            </button>
            <div className="workflow-side-panel__secondary">
              {selectedRun?.status === "failed" && (
                <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onRetryWorkflowRun()} type="button">
                  断点续跑
                </button>
              )}
              {selectedRun?.status === "running" && (
                <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onCancelWorkflowRun()} type="button">
                  取消运行
                </button>
              )}
              {selectedRun && (
                <button className="ghost-button" disabled={!selectedRun} onClick={onOpenRunDetail} type="button">
                  运行详情
                </button>
              )}
            </div>
            {workflowFeedback && <p className="workflow-side-panel__feedback">{workflowFeedback}</p>}
          </div>
        </div>
      )}

      {activeTab === "meeting" && selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">当前会议</span>
            <strong>{selectedMeeting.title}</strong>
            <p>{selectedMeeting.host} · {selectedMeeting.attendeeCount} 人参会</p>
          </div>

          <section className="workflow-side-panel__section">
            <div className="ide-section-title">
              <strong>议程</strong>
              <span>{selectedMeeting.agendaItems.length} 项</span>
            </div>
            {selectedMeeting.agendaItems.length === 0 ? (
              <p className="memory-empty">暂无议程，可在会议详情中补充。</p>
            ) : (
              selectedMeeting.agendaItems.slice(0, 5).map((item) => (
                <article className="ide-list-row" key={item.id}>
                  <i className={item.completed ? "is-done" : ""} />
                  <span>{item.title}</span>
                  <small>{item.completed ? "已完成" : "待讨论"}</small>
                </article>
              ))
            )}
          </section>

          <section className="workflow-side-panel__section">
            <div className="ide-section-title">
              <strong>待办</strong>
              <span>{selectedMeeting.actionItems.length} 项</span>
            </div>
            {selectedMeeting.actionItems.length === 0 ? (
              <p className="memory-empty">暂无待办事项。</p>
            ) : (
              selectedMeeting.actionItems.slice(0, 4).map((item) => (
                <article className="ide-list-row ide-list-row--action" key={item.id}>
                  <span>{item.content}</span>
                  <small>{actionItemStatusLabels[item.status]}</small>
                </article>
              ))
            )}
          </section>

          <div className="workflow-side-panel__secondary">
            <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={onEditMeeting} type="button">
              编辑会议
            </button>
            {nextMeetingStatus && (
              <button className="ghost-button" disabled={isWorkflowActionBusy} onClick={() => void onUpdateStatus(nextMeetingStatus.value)} type="button">
                {nextMeetingStatus.label}
              </button>
            )}
            <button className="ghost-button" onClick={onOpenDetail} type="button">
              查看详情
            </button>
          </div>
        </div>
      )}

      {activeTab === "meeting" && !selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <p className="memory-empty">请先从左侧选择一场会议。</p>
        </div>
      )}

      {activeTab === "memory" && selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <div className="workflow-side-panel__hero">
            <span className="section-kicker">会议记忆</span>
            <strong>{selectedMeeting.title}</strong>
            <p>{isMemoryLoading ? "同步中" : `${meetingMemories.length} 条经验记录`}</p>
          </div>

          <section className="meeting-memory-strip workflow-side-panel__section" aria-label="会议记忆">
            <div className="knowledge-index-panel" aria-label="向量索引">
              <div className="ide-section-title">
                <strong>向量索引</strong>
                <span>{knowledgeIndex.isLoading ? "同步中" : `${knowledgeIndex.index?.chunkCount ?? 0} 分片`}</span>
              </div>
              {knowledgeIndex.index ? (
                <p className="knowledge-vector-search__meta">
                  {knowledgeIndex.index.embeddingModel} · {knowledgeIndex.index.dimensions} 维 · 分片 {knowledgeIndex.index.chunking.chunkSize}/{knowledgeIndex.index.chunking.chunkOverlap}
                </p>
              ) : null}
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy || knowledgeIndex.isRebuilding}
                onClick={() => void knowledgeIndex.rebuildIndex()}
                type="button"
              >
                {knowledgeIndex.isRebuilding ? "重建中..." : "重建索引"}
              </button>
              {knowledgeIndex.error ? <p className="memory-empty">{knowledgeIndex.error}</p> : null}
              {knowledgeIndex.feedback ? <p className="workflow-side-panel__feedback">{knowledgeIndex.feedback}</p> : null}
            </div>

            <div className="knowledge-documents-panel" aria-label="知识文档">
              <div className="ide-section-title">
                <strong>知识文档</strong>
                <span>{knowledgeDocuments.isLoading ? "同步中" : `${knowledgeDocuments.items.length} 篇`}</span>
              </div>
              <label>
                <span>文档标题</span>
                <input
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  placeholder="例如：客户背景资料"
                  value={documentTitle}
                />
              </label>
              <label>
                <span>文档内容</span>
                <textarea
                  onChange={(event) => setDocumentContent(event.target.value)}
                  placeholder="粘贴 Markdown 或纯文本，上传后会自动分片并进入向量索引"
                  rows={4}
                  value={documentContent}
                />
              </label>
              <button
                className="ghost-button"
                disabled={isWorkflowActionBusy || knowledgeDocuments.isMutating || !documentContent.trim()}
                onClick={() => void knowledgeDocuments.uploadDocument(documentTitle, documentContent, "markdown").then((doc) => {
                  if (doc) {
                    setDocumentTitle("");
                    setDocumentContent("");
                    void knowledgeIndex.rebuildIndex();
                  }
                })}
                type="button"
              >
                {knowledgeDocuments.isMutating ? "上传中..." : "上传文档"}
              </button>
              {knowledgeDocuments.error ? <p className="memory-empty">{knowledgeDocuments.error}</p> : null}
              {knowledgeDocuments.feedback ? <p className="workflow-side-panel__feedback">{knowledgeDocuments.feedback}</p> : null}
              {knowledgeDocuments.items.slice(0, 4).map((document) => (
                <article className="memory-row memory-row--vector" key={document.id}>
                  <div className="memory-row__body">
                    <span>{document.title}</span>
                    <small>{document.format} · {document.content.slice(0, 80)}{document.content.length > 80 ? "..." : ""}</small>
                  </div>
                  <div className="memory-row__actions">
                    <button
                      className="memory-action-button memory-action-button--danger"
                      disabled={isWorkflowActionBusy || knowledgeDocuments.isMutating}
                      onClick={() => void knowledgeDocuments.deleteDocument(document.id).then((ok) => {
                        if (ok) void knowledgeIndex.rebuildIndex();
                      })}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="knowledge-vector-search" aria-label="向量检索">
              <label>
                <span>向量检索</span>
                <div className="knowledge-vector-search__row">
                  <input
                    onChange={(event) => knowledgeSearch.setQuery(event.target.value)}
                    placeholder="输入问题或关键词，例如：OKR 复盘风险"
                    value={knowledgeSearch.query}
                  />
                  <button
                    className="ghost-button"
                    disabled={isWorkflowActionBusy || knowledgeSearch.isSearching || !knowledgeSearch.query.trim()}
                    onClick={() => void knowledgeSearch.search()}
                    type="button"
                  >
                    {knowledgeSearch.isSearching ? "检索中..." : "检索"}
                  </button>
                </div>
              </label>
              {knowledgeSearch.embeddingModel ? (
                <small className="knowledge-vector-search__meta">Embedding: {knowledgeSearch.embeddingModel}</small>
              ) : null}
              {knowledgeSearch.error ? <p className="memory-empty">{knowledgeSearch.error}</p> : null}
              {knowledgeSearch.items.map((hit) => (
                <article className="memory-row memory-row--vector" key={`${hit.id}-${hit.similarity}`}>
                  <div className="memory-row__body">
                    <span>{hit.content}</span>
                    <small>{meetingMemoryKindLabels[hit.kind as keyof typeof meetingMemoryKindLabels] ?? hit.kind} · 相似度 {(hit.similarity * 100).toFixed(1)}%</small>
                  </div>
                </article>
              ))}
            </div>

            {memoryError ? <p className="memory-empty">{memoryError}</p> : null}
            {!memoryError && meetingMemories.length === 0 && !isMemoryLoading && (
              <p className="memory-empty">完成一次流程后会自动沉淀经验。</p>
            )}
            {meetingMemories.map((memory) => (
              <article className="memory-row" key={memory.id}>
                <div className="memory-row__body">
                  <span>{memory.content}</span>
                  <small>{meetingMemoryKindLabels[memory.kind]}</small>
                </div>
                <div className="memory-row__actions">
                  <button className="memory-action-button" disabled={isMemoryMutating || isWorkflowActionBusy} onClick={() => void onUpdateMemory(memory.id, { isPinned: !memory.isPinned })} type="button">
                    {memory.isPinned ? "取消置顶" : "置顶"}
                  </button>
                  <button className="memory-action-button memory-action-button--danger" disabled={isMemoryMutating || isWorkflowActionBusy} onClick={() => void onDeleteMemory(memory.id)} type="button">
                    删除
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}

      {activeTab === "memory" && !selectedMeeting && (
        <div className="workflow-side-panel" role="tabpanel">
          <p className="memory-empty">请先从左侧选择一场会议。</p>
        </div>
      )}
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import type { MeetingRecordWithPermissions } from "@meeting-flow/shared";
import { meetingMemoryKindLabels } from "@meeting-flow/shared";
import { useKnowledgeDocuments } from "../../../hooks/useKnowledgeDocuments";
import { useKnowledgeIndex } from "../../../hooks/useKnowledgeIndex";
import { useKnowledgeSearch } from "../../../hooks/useKnowledgeSearch";
import { readKnowledgeFile } from "../../../lib/knowledgeFileUpload";
import { formatEmbeddingModelLabel } from "../../../lib/accountIntegrationUtils";
import { SelectableCardList } from "../../common/SelectableCardList";
import { MeetingReadOnlyBanner } from "../layout/MeetingReadOnlyBanner";

type MeetingKnowledgeViewProps = {
  isWorkflowActionBusy: boolean;
  readOnly?: boolean;
  selectedMeeting: MeetingRecordWithPermissions;
};

export function MeetingKnowledgeView({ isWorkflowActionBusy, readOnly = false, selectedMeeting }: MeetingKnowledgeViewProps) {
  const meetingId = selectedMeeting.id;
  const knowledgeSearch = useKnowledgeSearch(meetingId, true);
  const knowledgeIndex = useKnowledgeIndex(true);
  const knowledgeDocuments = useKnowledgeDocuments(meetingId, true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [documentFormat, setDocumentFormat] = useState<"markdown" | "text">("text");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const selectedDocument = useMemo(
    () => knowledgeDocuments.items.find((document) => document.id === selectedDocumentId) ?? knowledgeDocuments.items[0] ?? null,
    [knowledgeDocuments.items, selectedDocumentId]
  );

  const documentCards = useMemo(
    () =>
      knowledgeDocuments.items.map((document) => ({
        id: document.id,
        title: document.title,
        badge: document.format,
        description: document.content.slice(0, 120) + (document.content.length > 120 ? "…" : "")
      })),
    [knowledgeDocuments.items]
  );

  const searchHitCards = useMemo(
    () =>
      knowledgeSearch.items.map((hit) => ({
        id: `${hit.id}-${hit.similarity}`,
        title: hit.content.slice(0, 72) + (hit.content.length > 72 ? "…" : ""),
        description: hit.content,
        meta: `${meetingMemoryKindLabels[hit.kind as keyof typeof meetingMemoryKindLabels] ?? hit.kind} · 相似度 ${(hit.similarity * 100).toFixed(1)}%`
      })),
    [knowledgeSearch.items]
  );

  const busy = isWorkflowActionBusy || knowledgeDocuments.isMutating || isReadingFile;

  async function handleFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    setIsReadingFile(true);
    setFileError("");

    try {
      const parsed = await readKnowledgeFile(file);
      setDocumentTitle(parsed.title);
      setDocumentContent(parsed.content);
      setDocumentFormat(parsed.format);
      setSelectedFileName(parsed.fileName);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "读取文件失败。");
      setSelectedFileName("");
    } finally {
      setIsReadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleUpload() {
    const doc = await knowledgeDocuments.uploadDocument(documentTitle, documentContent, documentFormat);
    if (!doc) {
      return;
    }

    setDocumentTitle("");
    setDocumentContent("");
    setDocumentFormat("text");
    setSelectedFileName("");
    setFileError("");
    setSelectedDocumentId(doc.id);
    void knowledgeIndex.rebuildIndex();
  }

  return (
    <section className={`knowledge-page${readOnly ? " knowledge-page--readonly" : ""}`} aria-label="知识库">
      <MeetingReadOnlyBanner meeting={selectedMeeting} />
      <header className="knowledge-page__index-bar">
        <div className="knowledge-page__index-copy">
          <strong>向量索引</strong>
          <span>
            {knowledgeIndex.isLoading
              ? "同步中"
              : `${knowledgeIndex.index?.chunkCount ?? 0} 分片 · ${knowledgeDocuments.items.length} 篇文档`}
          </span>
          {knowledgeIndex.index ? (
            <small>{formatEmbeddingModelLabel(knowledgeIndex.index.embeddingModel)} · {knowledgeIndex.index.dimensions} 维</small>
          ) : null}
          {!knowledgeIndex.available ? (
            <small className="knowledge-page__unavailable">未配置 AI API Key，知识库向量能力不可用</small>
          ) : null}
        </div>
        {!readOnly ? (
          <button
            className="ghost-button"
            disabled={busy || knowledgeIndex.isRebuilding || !knowledgeIndex.available}
            onClick={() => void knowledgeIndex.rebuildIndex()}
            type="button"
          >
            {knowledgeIndex.isRebuilding ? "重建中..." : "重建索引"}
          </button>
        ) : null}
      </header>

      {(knowledgeIndex.error || knowledgeIndex.feedback || knowledgeDocuments.error || knowledgeDocuments.feedback || fileError) ? (
        <p className="knowledge-page__feedback">
          {fileError || knowledgeIndex.error || knowledgeIndex.feedback || knowledgeDocuments.error || knowledgeDocuments.feedback}
        </p>
      ) : null}

      <div className="knowledge-page__body">
        <aside className="knowledge-page__list" aria-label="文档列表">
          {!readOnly ? (
            <div className="knowledge-page__upload">
              <div
                className={`knowledge-page__dropzone${isDragging ? " is-dragging" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setIsDragging(false);
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  void handleFile(event.dataTransfer.files?.[0]);
                }}
              >
                <strong>上传文件</strong>
                <span>支持 .txt / .md / .csv / .json，最大 2MB</span>
                <div className="knowledge-page__dropzone-actions">
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    {isReadingFile ? "读取中..." : "选择文件"}
                  </button>
                  {selectedFileName ? <small>{selectedFileName}</small> : null}
                </div>
                <input
                  accept=".txt,.md,.markdown,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json"
                  hidden
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                  ref={fileInputRef}
                  type="file"
                />
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
                <span>文档内容{selectedFileName ? "（可继续编辑）" : "（也可直接粘贴）"}</span>
                <textarea
                  onChange={(event) => setDocumentContent(event.target.value)}
                  placeholder="粘贴 Markdown / 纯文本，或通过上方选择文件"
                  rows={4}
                  value={documentContent}
                />
              </label>
              <button
                className="primary-button"
                disabled={busy || !documentContent.trim()}
                onClick={() => void handleUpload()}
                type="button"
              >
                {knowledgeDocuments.isMutating ? "上传中..." : "上传文档"}
              </button>
            </div>
          ) : null}

          <div className="knowledge-page__documents scroll-area">
            <SelectableCardList
              ariaLabel="知识文档"
              empty={
                <div className="knowledge-page__empty-stack">
                  <p className="knowledge-page__empty">
                    {readOnly ? "暂无可查看文档。" : "暂无文档，上传后即可参与检索。"}
                  </p>
                  {!readOnly ? (
                    <button
                      className="ghost-button"
                      disabled={busy}
                      onClick={() =>
                        void knowledgeDocuments.seedDemoDocuments().then((docs) => {
                          if (docs[0]) {
                            setSelectedDocumentId(docs[0].id);
                            void knowledgeIndex.rebuildIndex();
                          }
                        })
                      }
                      type="button"
                    >
                      填充示例文档
                    </button>
                  ) : null}
                </div>
              }
              items={documentCards}
              layout="stack"
              onSelect={setSelectedDocumentId}
              selectedId={selectedDocument?.id ?? null}
            />
          </div>
        </aside>

        <div className="knowledge-page__main">
          <section className="knowledge-page__preview" aria-label="文档预览">
            {selectedDocument ? (
              <>
                <header className="knowledge-page__preview-head">
                  <div>
                    <strong>{selectedDocument.title}</strong>
                    <span>{selectedDocument.format}</span>
                  </div>
                  {!readOnly ? (
                    <button
                      className="danger-button"
                      disabled={busy}
                      onClick={() => void knowledgeDocuments.deleteDocument(selectedDocument.id).then((ok) => {
                        if (ok) void knowledgeIndex.rebuildIndex();
                      })}
                      type="button"
                    >
                      删除
                    </button>
                  ) : null}
                </header>
                <pre className="knowledge-page__preview-body scroll-area">{selectedDocument.content}</pre>
              </>
            ) : (
              <p className="knowledge-page__empty">选择一篇文档查看内容。</p>
            )}
          </section>

          <section className="knowledge-page__search" aria-label="检索测试">
            <div className="knowledge-page__search-row">
              <input
                onChange={(event) => knowledgeSearch.setQuery(event.target.value)}
                placeholder="输入问题或关键词测试检索"
                value={knowledgeSearch.query}
              />
              <button
                className="primary-button"
                disabled={busy || knowledgeSearch.isSearching || !knowledgeSearch.query.trim()}
                onClick={() => void knowledgeSearch.search()}
                type="button"
              >
                {knowledgeSearch.isSearching ? "检索中..." : "检索"}
              </button>
            </div>
            {knowledgeSearch.embeddingModel ? (
              <small className="knowledge-page__search-meta">Embedding: {knowledgeSearch.embeddingModel}</small>
            ) : null}
            {knowledgeSearch.error ? <p className="knowledge-page__feedback">{knowledgeSearch.error}</p> : null}
            <div className="knowledge-page__hits scroll-area">
              <SelectableCardList
                ariaLabel="检索结果"
                empty={
                  knowledgeSearch.query.trim() && !knowledgeSearch.isSearching
                    ? <p className="knowledge-page__empty">暂无命中结果。</p>
                    : null
                }
                items={searchHitCards}
                layout="stack"
              />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

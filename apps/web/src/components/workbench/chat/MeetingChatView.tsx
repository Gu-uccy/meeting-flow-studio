import { useEffect, useRef } from "react";
import type { MeetingRecordWithPermissions } from "@meeting-flow/shared";
import type { useMeetingChat } from "../../../hooks/useMeetingChat";

type MeetingChatViewProps = {
  canClearChat?: boolean;
  chat: ReturnType<typeof useMeetingChat>;
  isWorkflowActionBusy: boolean;
  runtimeLabel?: string;
  selectedMeeting: MeetingRecordWithPermissions;
};

export function MeetingChatView({
  canClearChat = true,
  chat,
  isWorkflowActionBusy,
  runtimeLabel,
  selectedMeeting
}: MeetingChatViewProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isDegraded = runtimeLabel === "未配置密钥";

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [chat.items.length, chat.isSending]);

  return (
    <section className="chat-page" aria-label="会议对话">
      <header className="chat-page__header">
        <div>
          <strong>{selectedMeeting.title}</strong>
          <p>结合会议上下文与知识库回答问题{runtimeLabel ? ` · ${runtimeLabel}` : ""}</p>
        </div>
        {canClearChat ? (
          <button
            className="ghost-button"
            disabled={isWorkflowActionBusy || chat.isSending || chat.items.length === 0}
            onClick={() => void chat.clearMessages()}
            type="button"
          >
            清空对话
          </button>
        ) : null}
      </header>
      {isDegraded ? (
        <p className="chat-page__runtime-banner" role="status">
          未配置 AI API Key，会议对话不可用。请先在账号设置中填写 OpenAI 兼容密钥。
        </p>
      ) : null}
      <div className="chat-page__messages scroll-area" ref={listRef}>
        {chat.isLoading ? <p className="chat-page__empty">加载对话中…</p> : null}
        {!chat.isLoading && chat.items.length === 0 ? (
          <p className="chat-page__empty">可以询问会议背景、流程状态或知识库内容。</p>
        ) : null}
        {chat.items.map((message) => (
          <article className={`chat-page__message chat-page__message--${message.role}`} key={message.id}>
            <header className="chat-page__message-head">
              <span>{message.role === "user" ? "你" : "助手"}</span>
            </header>
            <p>{message.content}</p>
            {message.citations.length > 0 ? (
              <div className="chat-page__citations">
                {message.citations.map((citation, index) => (
                  <blockquote className="chat-page__citation" key={`${message.id}-cite-${index}`}>
                    <span>引用</span>
                    <p>{citation.content}</p>
                    {typeof citation.similarity === "number" ? (
                      <small>{(citation.similarity * 100).toFixed(1)}% 相似</small>
                    ) : null}
                  </blockquote>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {chat.isSending ? <p className="chat-page__empty">正在思考…</p> : null}
      </div>

      {chat.error ? <p className="chat-page__feedback">{chat.error}</p> : null}

      <form
        className="chat-page__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void chat.sendMessage();
        }}
      >
        <textarea
          aria-label="输入问题"
          onChange={(event) => chat.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void chat.sendMessage();
            }
          }}
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          rows={3}
          value={chat.draft}
        />
        <button
          className="primary-button"
          disabled={isWorkflowActionBusy || chat.isSending || !chat.draft.trim() || isDegraded}
          type="submit"
        >
          {isDegraded ? "需配置 Key" : chat.isSending ? "发送中..." : "发送"}
        </button>
      </form>
    </section>
  );
}

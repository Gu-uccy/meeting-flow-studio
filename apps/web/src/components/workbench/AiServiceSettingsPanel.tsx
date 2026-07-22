import { useWorkbench } from "../../contexts/WorkbenchContext";

type AiServiceSettingsPanelProps = {
  className?: string;
  id?: string;
};

/** Form body for OpenAI-compatible AI settings (section chrome owned by parent). */
export function AiServiceSettingsPanel({ className = "", id }: AiServiceSettingsPanelProps) {
  const { aiSettings } = useWorkbench();

  const keySourceLabel = aiSettings.isLoading
    ? "加载中"
    : aiSettings.settings.keySource === "user"
      ? `用户 Key ${aiSettings.settings.keyHint}`
      : aiSettings.settings.keySource === "environment"
        ? "环境变量 AI_API_KEY / OPENAI_API_KEY"
        : "未配置";

  return (
    <div className={`config-page__ai-form${className ? ` ${className}` : ""}`} id={id}>
      <dl className="account-detail-list">
        <div>
          <dt>协议</dt>
          <dd>OpenAI Compatible</dd>
        </div>
        <div>
          <dt>当前来源</dt>
          <dd>{keySourceLabel}</dd>
        </div>
        <div>
          <dt>对话模型</dt>
          <dd>{aiSettings.settings.chatModel || "gpt-4o-mini"}</dd>
        </div>
        <div>
          <dt>Embedding 模型</dt>
          <dd>{aiSettings.settings.embeddingModel || "text-embedding-3-small"}</dd>
        </div>
      </dl>
      <div className="account-ai-form account-ai-form--stack">
        <label>
          <span>API Key</span>
          <input
            aria-label="AI API Key"
            autoComplete="off"
            disabled={aiSettings.isMutating}
            onChange={(event) => aiSettings.setApiKeyDraft(event.target.value)}
            placeholder="sk-... 或兼容网关密钥"
            type="password"
            value={aiSettings.apiKeyDraft}
          />
        </label>
        <label>
          <span>Base URL</span>
          <input
            aria-label="AI Base URL"
            disabled={aiSettings.isMutating}
            onChange={(event) => aiSettings.setBaseUrlDraft(event.target.value)}
            placeholder="https://api.openai.com/v1"
            type="url"
            value={aiSettings.baseUrlDraft}
          />
        </label>
        <label>
          <span>对话模型</span>
          <input
            aria-label="Chat model"
            disabled={aiSettings.isMutating}
            onChange={(event) => aiSettings.setChatModelDraft(event.target.value)}
            placeholder="gpt-4o-mini"
            type="text"
            value={aiSettings.chatModelDraft}
          />
        </label>
        <label>
          <span>Embedding 模型</span>
          <input
            aria-label="Embedding model"
            disabled={aiSettings.isMutating}
            onChange={(event) => aiSettings.setEmbeddingModelDraft(event.target.value)}
            placeholder="text-embedding-3-small"
            type="text"
            value={aiSettings.embeddingModelDraft}
          />
        </label>
        <div>
          <button
            className="primary-button"
            disabled={aiSettings.isMutating || !aiSettings.apiKeyDraft.trim()}
            onClick={() => void aiSettings.saveApiKey()}
            type="button"
          >
            保存配置
          </button>
          <button
            className="ghost-button"
            disabled={aiSettings.isMutating || !aiSettings.settings.isUserConfigured}
            onClick={() => void aiSettings.deleteApiKey()}
            type="button"
          >
            删除用户配置
          </button>
        </div>
      </div>
    </div>
  );
}

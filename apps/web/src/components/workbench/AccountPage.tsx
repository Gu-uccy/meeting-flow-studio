import { userRoleLabels } from "@meeting-flow/shared";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { formatDateTime } from "../../lib/format";
import { StatusBanner } from "../common/StatusBanner";

export function AccountPage() {
  const { user } = useAuth();
  const { aiSettings, setWorkbenchView } = useWorkbench();

  if (!user) {
    return null;
  }

  const keySourceLabel = aiSettings.isLoading
    ? "加载中"
    : aiSettings.settings.keySource === "user"
      ? `用户 Key ${aiSettings.settings.keyHint}`
      : aiSettings.settings.keySource === "environment"
        ? "服务端环境变量"
        : "本地规则降级";

  return (
    <section className="account-page" aria-labelledby="account-title">
      <div className="account-page__header">
        <div>
          <span className="section-kicker">Account</span>
          <h1 id="account-title">账号管理</h1>
          <p>查看当前登录账号、权限和基础安全信息。</p>
        </div>
        <button className="ghost-button" onClick={() => setWorkbenchView("workspace")} type="button">
          返回工作台
        </button>
      </div>

      <div className="account-page__grid">
        <article className="account-profile">
          <div className="account-profile__avatar" aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span>当前账号</span>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
        </article>

        <article className="account-panel">
          <h2>账号信息</h2>
          <dl className="account-detail-list">
            <div>
              <dt>姓名</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>角色</dt>
              <dd>{userRoleLabels[user.role]}</dd>
            </div>
            <div>
              <dt>账号 ID</dt>
              <dd>{user.id}</dd>
            </div>
          </dl>
        </article>

        <article className="account-panel">
          <h2>安全状态</h2>
          <dl className="account-detail-list">
            <div>
              <dt>登录状态</dt>
              <dd>已登录</dd>
            </div>
            <div>
              <dt>创建时间</dt>
              <dd>{formatDateTime(user.createdAt)}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatDateTime(user.updatedAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="account-panel account-panel--ai">
          <h2>AI Agent 设置</h2>
          <StatusBanner error={aiSettings.error} feedback={aiSettings.feedback} />
          <dl className="account-detail-list">
            <div>
              <dt>模型服务</dt>
              <dd>Anthropic</dd>
            </div>
            <div>
              <dt>当前来源</dt>
              <dd>{keySourceLabel}</dd>
            </div>
          </dl>
          <div className="account-ai-form">
            <input
              aria-label="Anthropic API Key"
              autoComplete="off"
              disabled={aiSettings.isMutating}
              onChange={(event) => aiSettings.setApiKeyDraft(event.target.value)}
              placeholder="输入 Anthropic API Key"
              type="password"
              value={aiSettings.apiKeyDraft}
            />
            <div>
              <button
                className="primary-button"
                disabled={aiSettings.isMutating || !aiSettings.apiKeyDraft.trim()}
                onClick={() => void aiSettings.saveApiKey()}
                type="button"
              >
                保存 Key
              </button>
              <button
                className="ghost-button"
                disabled={aiSettings.isMutating || !aiSettings.settings.isUserConfigured}
                onClick={() => void aiSettings.deleteApiKey()}
                type="button"
              >
                删除用户 Key
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import type { AiApplication } from "@meeting-flow/shared";
import { useKnowledgeIndex } from "../../hooks/useKnowledgeIndex";
import { useServiceKeyOverview } from "../../hooks/useServiceKeyOverview";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { formatDateTime } from "../../lib/format";
import {
  buildPlatformOverviewStats,
  getAiIntegrationStatus,
  getCalendarIntegrationStatus,
  getKnowledgeIntegrationStatus,
  getServiceApiIntegrationStatus,
  type IntegrationStatus,
  type IntegrationTone
} from "../../lib/accountIntegrationUtils";
import { SHOW_BACKUP_MEETING_APPS } from "../../lib/meetingAppConnection";
import type { ServiceKeyRecord } from "../../hooks/useServiceApiKeys";
import { StatusBanner } from "../common/StatusBanner";
import { SelectableCardList } from "../common/SelectableCardList";

type AccountIntegrationOverviewProps = {
  onOpenConfig: () => void;
};

function integrationToneClass(tone: IntegrationTone) {
  return `integration-badge integration-badge--${tone}`;
}

function IntegrationCard(props: {
  title: string;
  status: IntegrationStatus;
  children?: ReactNode;
}) {
  return (
    <article className={`account-integration-card account-integration-card--${props.status.tone}`}>
      <div className="account-integration-card__head">
        <strong>{props.title}</strong>
        <span className={integrationToneClass(props.status.tone)}>{props.status.label}</span>
      </div>
      <p>{props.status.detail}</p>
      {props.children}
    </article>
  );
}

function ServiceKeyApplicationPanel(props: {
  application: AiApplication;
  createdKey?: string;
  isMutating: boolean;
  items: ServiceKeyRecord[];
  onCreateKey: (label?: string) => void;
  onDeleteKey: (keyId: string) => void;
}) {
  const [labelDraft, setLabelDraft] = useState("");

  return (
    <article className="account-service-key-app">
      <div className="account-service-key-app__head">
        <div>
          <strong>{props.application.name}</strong>
          <p>{props.application.apiEndpoint}</p>
        </div>
        <span className="integration-badge integration-badge--ready">{props.application.status}</span>
      </div>

      <div className="account-service-key-app__create">
        <input
          aria-label={`${props.application.name} Service Key 标签`}
          disabled={props.isMutating}
          onChange={(event) => setLabelDraft(event.target.value)}
          placeholder="密钥标签，例如 prod-cron"
          type="text"
          value={labelDraft}
        />
        <button
          className="primary-button"
          disabled={props.isMutating}
          onClick={() => props.onCreateKey(labelDraft)}
          type="button"
        >
          创建密钥
        </button>
      </div>

      {props.createdKey && (
        <div className="account-service-key-app__created">
          <span>新密钥（仅显示一次）</span>
          <code>{props.createdKey}</code>
        </div>
      )}

      <div className="account-service-key-app__list">
        <SelectableCardList
          ariaLabel="Service API Key"
          empty={<p className="account-integration-empty">尚未创建 Service API Key</p>}
          items={props.items.map((item) => ({
            id: item.id,
            title: item.label,
            meta: `${item.keyHint} · ${formatDateTime(item.createdAt)}`,
            actions: (
              <button
                className="ghost-button"
                disabled={props.isMutating}
                onClick={() => props.onDeleteKey(item.id)}
                type="button"
              >
                删除
              </button>
            )
          }))}
          layout="stack"
        />
      </div>
    </article>
  );
}

export function AccountIntegrationOverview({ onOpenConfig }: AccountIntegrationOverviewProps) {
  const {
    aiSettings,
    feishuCalendar,
    googleCalendar,
    meetings,
    openRunsConsole,
    setWorkbenchView,
    workflow
  } = useWorkbench();
  const knowledgeIndex = useKnowledgeIndex(true);

  const publishedApplications = useMemo(
    () => workflow.applications.filter((item) => item.status === "published"),
    [workflow.applications]
  );
  const serviceKeys = useServiceKeyOverview(publishedApplications);

  const platformStats = buildPlatformOverviewStats({
    meetingCount: meetings.allMeetings.length,
    templateCount: workflow.templates.length,
    applications: workflow.applications,
    runs: workflow.runs,
    serviceKeyCount: serviceKeys.totalCount
  });

  const aiStatus = getAiIntegrationStatus(aiSettings.settings, aiSettings.isLoading);
  const googleStatus = getCalendarIntegrationStatus({
    providerLabel: "Google Calendar",
    isConfigured: googleCalendar.isConfigured,
    isConnected: googleCalendar.isConnected,
    isLoading: googleCalendar.isLoading,
    statusMessage: googleCalendar.statusMessage
  });
  const feishuStatus = getCalendarIntegrationStatus({
    providerLabel: "飞书日历",
    isConfigured: feishuCalendar.isConfigured,
    isConnected: feishuCalendar.isConnected,
    isLoading: feishuCalendar.isLoading,
    statusMessage: feishuCalendar.statusMessage
  });
  const knowledgeStatus = getKnowledgeIntegrationStatus(knowledgeIndex.index, knowledgeIndex.isLoading, knowledgeIndex.available);
  const serviceApiStatus = getServiceApiIntegrationStatus(publishedApplications, serviceKeys.totalCount);

  return (
    <div className="account-integration-overview">
      <StatusBanner
        error={[...(SHOW_BACKUP_MEETING_APPS ? [googleCalendar.error] : []), feishuCalendar.error, knowledgeIndex.error, serviceKeys.error].filter(Boolean).join(" · ")}
        feedback={[...(SHOW_BACKUP_MEETING_APPS ? [googleCalendar.feedback] : []), feishuCalendar.feedback, knowledgeIndex.feedback, serviceKeys.feedback].filter(Boolean).join(" · ")}
      />

      <section className="account-platform-stats" aria-label="平台概览">
        <article><span>会议</span><strong>{platformStats.meetingCount}</strong></article>
        <article><span>模板</span><strong>{platformStats.templateCount}</strong></article>
        <article><span>已发布应用</span><strong>{platformStats.publishedApplicationCount}</strong></article>
        <article><span>运行记录</span><strong>{platformStats.runCount}</strong></article>
        <article className="is-active"><span>活跃运行</span><strong>{platformStats.activeRunCount}</strong></article>
        <article className="is-blocked"><span>阻塞运行</span><strong>{platformStats.blockedRunCount}</strong></article>
      </section>

      <div className="account-platform-links">
        <button className="ghost-button" onClick={() => setWorkbenchView("workspace")} type="button">流程画布</button>
        <button className="ghost-button" onClick={() => openRunsConsole()} type="button">运行控制台</button>
        {platformStats.blockedRunCount > 0 && (
          <button className="primary-button" onClick={() => openRunsConsole({ status: "blocked" })} type="button">
            处理 {platformStats.blockedRunCount} 个阻塞
          </button>
        )}
      </div>

      <section className="account-integration-grid" aria-label="集成总览">
        <IntegrationCard status={aiStatus} title="AI 服务（OpenAI 兼容）">
          <div className="account-integration-card__actions">
            <button className="ghost-button" onClick={onOpenConfig} type="button">
              打开配置页
            </button>
          </div>
        </IntegrationCard>

        {SHOW_BACKUP_MEETING_APPS ? (
          <IntegrationCard status={googleStatus} title="Google Calendar">
            <div className="account-integration-card__actions">
              <button
                className="ghost-button"
                disabled={googleCalendar.isMutating || !googleCalendar.isConfigured || googleCalendar.isConnected}
                onClick={() => void googleCalendar.connectGoogleCalendar()}
                type="button"
              >
                连接 Google
              </button>
              {googleCalendar.redirectUri && <code>{googleCalendar.redirectUri}</code>}
            </div>
          </IntegrationCard>
        ) : null}

        <IntegrationCard status={feishuStatus} title="飞书会议">
          <div className="account-integration-card__actions">
            <button
              className="primary-button"
              disabled={feishuCalendar.isMutating || !feishuCalendar.isConfigured || feishuCalendar.isConnected}
              onClick={() => void feishuCalendar.connectFeishuCalendar()}
              type="button"
            >
              连接飞书
            </button>
            <button className="ghost-button" onClick={onOpenConfig} type="button">
              打开配置页
            </button>
            {feishuCalendar.redirectUri && <code>{feishuCalendar.redirectUri}</code>}
          </div>
        </IntegrationCard>

        <IntegrationCard status={knowledgeStatus} title="知识库向量索引">
          <dl className="account-integration-meta">
            <div><dt>分片</dt><dd>{knowledgeIndex.index?.chunkCount ?? 0}</dd></div>
            <div><dt>模型</dt><dd>{knowledgeIndex.index?.embeddingModel ?? "-"}</dd></div>
            <div><dt>维度</dt><dd>{knowledgeIndex.index?.dimensions ?? "-"}</dd></div>
          </dl>
          <div className="account-integration-card__actions">
            <button
              className="ghost-button"
              disabled={knowledgeIndex.isRebuilding}
              onClick={() => void knowledgeIndex.rebuildIndex()}
              type="button"
            >
              {knowledgeIndex.isRebuilding ? "重建中..." : "重建索引"}
            </button>
          </div>
        </IntegrationCard>

        <IntegrationCard status={serviceApiStatus} title="Service API">
          <p className="account-integration-note">
            对外调用：<code>POST /api/v1/apps/:applicationId/run</code>，Header 使用 <code>Authorization: Bearer mfs_sk_...</code>
          </p>
        </IntegrationCard>
      </section>

      <section className="account-service-keys" aria-label="Service API Key 管理">
        <div className="account-service-keys__head">
          <div>
            <h2>Service API Key</h2>
            <p>为已发布应用创建对外调用密钥，启动工作流并返回 202 异步任务。</p>
          </div>
          <button
            className="ghost-button"
            disabled={serviceKeys.isLoading}
            onClick={() => void serviceKeys.reloadAll()}
            type="button"
          >
            刷新密钥
          </button>
        </div>

        {publishedApplications.length > 0 ? (
          publishedApplications.map((application) => (
            <ServiceKeyApplicationPanel
              application={application}
              createdKey={serviceKeys.createdKeysByApplicationId[application.id]}
              isMutating={serviceKeys.isMutating}
              items={serviceKeys.keysByApplicationId[application.id] ?? []}
              key={application.id}
              onCreateKey={(label) => void serviceKeys.createKey(application.id, label)}
              onDeleteKey={(keyId) => void serviceKeys.deleteKey(application.id, keyId)}
            />
          ))
        ) : (
          <p className="account-integration-empty">暂无已发布应用。请先在节点智能体管理中发布应用。</p>
        )}
      </section>
    </div>
  );
}

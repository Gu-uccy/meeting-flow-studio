import type { AiApplication, ProductWorkflowRun } from "@meeting-flow/shared";
import type { AiSettings } from "../hooks/useAiSettings";
import type { KnowledgeIndexStats } from "../hooks/useKnowledgeIndex";

export type IntegrationTone = "ready" | "attention" | "unavailable" | "loading";

export type IntegrationStatus = {
  tone: IntegrationTone;
  label: string;
  detail: string;
};

export type PlatformOverviewStats = {
  meetingCount: number;
  templateCount: number;
  applicationCount: number;
  publishedApplicationCount: number;
  runCount: number;
  blockedRunCount: number;
  activeRunCount: number;
  serviceKeyCount: number;
};

export function getAiIntegrationStatus(settings: AiSettings, isLoading: boolean): IntegrationStatus {
  if (isLoading) {
    return { tone: "loading", label: "加载中", detail: "正在读取 AI 配置" };
  }

  if (settings.keySource === "user") {
    return {
      tone: "ready",
      label: "用户 Key",
      detail: `已配置 Anthropic Key ${settings.keyHint}`
    };
  }

  if (settings.keySource === "environment") {
    return {
      tone: "ready",
      label: "服务端 Key",
      detail: "使用环境变量中的 Anthropic API Key"
    };
  }

  return {
    tone: "attention",
    label: "未配置",
    detail: "Agent 与 LLM 节点将降级为本地规则"
  };
}

export function getCalendarIntegrationStatus(params: {
  providerLabel: string;
  isConfigured: boolean;
  isConnected: boolean;
  isLoading: boolean;
  statusMessage?: string;
}): IntegrationStatus {
  if (params.isLoading) {
    return { tone: "loading", label: "加载中", detail: `正在读取 ${params.providerLabel} 状态` };
  }

  if (!params.isConfigured) {
    return {
      tone: "unavailable",
      label: "未启用",
      detail: params.statusMessage || `服务端尚未配置 ${params.providerLabel} OAuth`
    };
  }

  if (params.isConnected) {
    return {
      tone: "ready",
      label: "已连接",
      detail: params.statusMessage || `${params.providerLabel} 授权已完成，可同步会议`
    };
  }

  return {
    tone: "attention",
    label: "待授权",
    detail: params.statusMessage || `点击连接 ${params.providerLabel} 完成 OAuth 授权`
  };
}

export function getKnowledgeIntegrationStatus(
  index: KnowledgeIndexStats | null,
  isLoading: boolean
): IntegrationStatus {
  if (isLoading) {
    return { tone: "loading", label: "加载中", detail: "正在读取向量索引状态" };
  }

  if (!index) {
    return {
      tone: "attention",
      label: "未知",
      detail: "无法读取知识库向量索引"
    };
  }

  if (index.chunkCount > 0) {
    return {
      tone: "ready",
      label: "已就绪",
      detail: `${index.chunkCount} 个向量分片 · ${index.embeddingModel}`
    };
  }

  return {
    tone: "attention",
    label: "待构建",
    detail: `索引为空，上传记忆/文档后重建 · ${index.embeddingModel}`
  };
}

export function getServiceApiIntegrationStatus(
  publishedApplications: AiApplication[],
  serviceKeyCount: number
): IntegrationStatus {
  if (publishedApplications.length === 0) {
    return {
      tone: "unavailable",
      label: "无已发布应用",
      detail: "发布工作流应用后可创建 Service API Key"
    };
  }

  if (serviceKeyCount > 0) {
    return {
      tone: "ready",
      label: "已启用",
      detail: `${serviceKeyCount} 把密钥 · ${publishedApplications.length} 个已发布应用`
    };
  }

  return {
    tone: "attention",
    label: "待创建",
    detail: `${publishedApplications.length} 个已发布应用可创建对外调用密钥`
  };
}

export function buildPlatformOverviewStats(params: {
  meetingCount: number;
  templateCount: number;
  applications: AiApplication[];
  runs: ProductWorkflowRun[];
  serviceKeyCount: number;
}): PlatformOverviewStats {
  const blockedRunCount = params.runs.filter(
    (run) => run.status === "blocked" || run.nodeRuns.some((nodeRun) => nodeRun.status === "blocked")
  ).length;

  return {
    meetingCount: params.meetingCount,
    templateCount: params.templateCount,
    applicationCount: params.applications.length,
    publishedApplicationCount: params.applications.filter((item) => item.status === "published").length,
    runCount: params.runs.length,
    blockedRunCount,
    activeRunCount: params.runs.filter((run) => run.status === "running" || run.status === "queued").length,
    serviceKeyCount: params.serviceKeyCount
  };
}

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
      detail: `OpenAI 兼容 · ${settings.keyHint} · ${settings.chatModel}`
    };
  }

  if (settings.keySource === "environment") {
    return {
      tone: "ready",
      label: "服务端 Key",
      detail: `使用环境变量 AI_API_KEY / OPENAI_API_KEY · ${settings.chatModel}`
    };
  }

  return {
    tone: "unavailable",
    label: "不可用",
    detail: "未配置 AI Key：对话、Agent、知识检索与 AI 节点无法使用"
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
      label: "未配置",
      detail: params.statusMessage || `服务端尚未配置 ${params.providerLabel} OAuth，无法同步`
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
  isLoading: boolean,
  available = true
): IntegrationStatus {
  if (isLoading) {
    return { tone: "loading", label: "加载中", detail: "正在读取向量索引状态" };
  }

  if (!available) {
    return {
      tone: "unavailable",
      label: "不可用",
      detail: "未配置 AI API Key，知识库向量检索无法使用"
    };
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

export function formatEmbeddingModelLabel(embeddingModel: string) {
  if (!embeddingModel || embeddingModel === "unavailable") {
    return "未配置（需 AI API Key）";
  }
  return embeddingModel;
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

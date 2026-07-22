import type { WorkbenchView } from "../../../contexts/WorkbenchContext";
import type { WorkflowSidePanelTab } from "../../workflow/WorkflowSideTabs";

export type WorkbenchViewMeta = {
  description: string;
  kicker: string;
  label: string;
  shortLabel: string;
};

export const workbenchViewMeta: Record<WorkbenchView, WorkbenchViewMeta> = {
  workspace: {
    kicker: "Meeting Flow",
    label: "会议流程",
    shortLabel: "流程",
    description: "编辑模板、运行流程并处理阻塞节点"
  },
  meeting: {
    kicker: "Meeting Overview",
    label: "会议概览",
    shortLabel: "会议",
    description: "查看议程、待办与会议状态"
  },
  chat: {
    kicker: "Meeting Chat",
    label: "会议对话",
    shortLabel: "对话",
    description: "基于会议上下文与知识库进行问答"
  },
  knowledge: {
    kicker: "Knowledge Base",
    label: "知识库",
    shortLabel: "知识库",
    description: "上传文档、维护索引并测试检索"
  },
  memories: {
    kicker: "Meeting Memory",
    label: "会议记忆",
    shortLabel: "记忆",
    description: "查看与管理流程沉淀的经验记录"
  },
  "meeting-agent": {
    kicker: "Flow Agent",
    label: "工作流 Agent",
    shortLabel: "Agent",
    description: "自动匹配模板并推进会议流程"
  },
  config: {
    kicker: "Workbench Config",
    label: "工作台配置",
    shortLabel: "配置",
    description: "统一管理 AI 服务密钥与飞书会议连接"
  },
  schedules: {
    kicker: "Workflow Schedules",
    label: "定时任务",
    shortLabel: "定时",
    description: "按 Cron 表达式自动启动工作流"
  },
  runs: {
    kicker: "Run Console",
    label: "运行控制台",
    shortLabel: "运行",
    description: "跨会议查看运行状态、处理阻塞与失败"
  },
  apps: {
    kicker: "Node Agent",
    label: "节点智能体",
    shortLabel: "智能体",
    description: "配置节点 Prompt、映射与版本发布"
  },
  account: {
    kicker: "Settings",
    label: "账号与集成",
    shortLabel: "设置",
    description: "管理账号资料、审计日志与平台集成总览"
  }
};

export const meetingWorkbenchViews: WorkbenchView[] = [
  "config",
  "workspace",
  "meeting",
  "chat",
  "knowledge",
  "memories",
  "meeting-agent",
  "schedules"
];

const meetingSidePanelViewMap: Partial<Record<WorkbenchView, WorkflowSidePanelTab>> = {
  meeting: "meeting",
  memories: "memory",
  "meeting-agent": "agent",
  config: "config",
  schedules: "schedules"
};

export function resolveMeetingSidePanelTab(view: WorkbenchView) {
  return meetingSidePanelViewMap[view] ?? null;
}

export function isMeetingWorkbenchView(view: WorkbenchView) {
  return meetingWorkbenchViews.includes(view);
}

export const fullBleedWorkbenchViews: WorkbenchView[] = [...meetingWorkbenchViews, "apps"];

export function isFullBleedWorkbenchView(view: WorkbenchView) {
  return fullBleedWorkbenchViews.includes(view);
}

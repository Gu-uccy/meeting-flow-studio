type WorkflowSideTabsProps<T extends string> = {
  activeTab: T;
  ariaLabel?: string;
  onChange: (tab: T) => void;
  tabs: Array<{ id: T; label: string; title?: string }>;
  variant?: "default" | "compact";
};

export function WorkflowSideTabs<T extends string>({
  activeTab,
  ariaLabel = "侧栏视图",
  onChange,
  tabs,
  variant = "default"
}: WorkflowSideTabsProps<T>) {
  const compact = variant === "compact";

  return (
    <div
      className={`workflow-side-tabs${compact ? " workflow-side-tabs--compact" : ""}`}
      role="tablist"
      aria-label={ariaLabel}
      style={{ ["--tab-count" as string]: compact ? 3 : tabs.length }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          aria-selected={activeTab === tab.id}
          className={`workflow-side-tabs__button${activeTab === tab.id ? " is-active" : ""}`}
          onClick={() => onChange(tab.id)}
          role="tab"
          title={tab.title ?? tab.label}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type WorkflowDetailTab = "meeting" | "memory";
export type WorkflowExtensionTab = "agent" | "config" | "schedules" | "capabilities";

export const workflowDetailTabs: Array<{ id: WorkflowDetailTab; label: string }> = [
  { id: "meeting", label: "会议" },
  { id: "memory", label: "记忆" }
];

export const workflowExtensionTabs: Array<{ id: WorkflowExtensionTab; label: string }> = [
  { id: "agent", label: "工作流 Agent" },
  { id: "config", label: "工作台配置" },
  { id: "schedules", label: "定时任务" },
  { id: "capabilities", label: "能力模型" }
];

export type WorkflowSidePanelTab = WorkflowDetailTab | Exclude<WorkflowExtensionTab, "capabilities">;

export const workflowSidePanelTabs: Array<{ id: WorkflowSidePanelTab; label: string; title: string }> = [
  { id: "meeting", label: "会议", title: "会议" },
  { id: "memory", label: "记忆", title: "会议记忆" },
  { id: "agent", label: "Agent", title: "工作流 Agent" },
  { id: "config", label: "配置", title: "工作台配置" },
  { id: "schedules", label: "定时", title: "定时任务" }
];

export function isWorkflowDetailTab(tab: WorkflowSidePanelTab): tab is WorkflowDetailTab {
  return tab === "meeting" || tab === "memory";
}

type WorkflowSideTabsProps<T extends string> = {
  activeTab: T;
  ariaLabel?: string;
  onChange: (tab: T) => void;
  tabs: Array<{ id: T; label: string }>;
};

export function WorkflowSideTabs<T extends string>({
  activeTab,
  ariaLabel = "侧栏视图",
  onChange,
  tabs
}: WorkflowSideTabsProps<T>) {
  return (
    <div
      className="workflow-side-tabs"
      role="tablist"
      aria-label={ariaLabel}
      style={{ ["--tab-count" as string]: tabs.length }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          aria-selected={activeTab === tab.id}
          className={`workflow-side-tabs__button${activeTab === tab.id ? " is-active" : ""}`}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type WorkflowDetailTab = "run" | "meeting" | "memory";
export type WorkflowExtensionTab = "agent" | "calendar" | "schedules" | "capabilities";

export const workflowDetailTabs: Array<{ id: WorkflowDetailTab; label: string }> = [
  { id: "run", label: "运行" },
  { id: "meeting", label: "会议" },
  { id: "memory", label: "记忆" }
];

export const workflowExtensionTabs: Array<{ id: WorkflowExtensionTab; label: string }> = [
  { id: "agent", label: "工作流 Agent" },
  { id: "calendar", label: "日历同步" },
  { id: "schedules", label: "定时任务" },
  { id: "capabilities", label: "能力模型" }
];

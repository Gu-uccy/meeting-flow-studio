import { meetingNodeKindLabels, type AiApplication, type ProductWorkflowTemplate } from "@meeting-flow/shared";
import type { NodeAgentStudioTab } from "../../../stores/nodeAgentStore";
import { SelectableCardList } from "../../common/SelectableCardList";

type NodeAgentBinding = {
  application: AiApplication | null | undefined;
  node: ProductWorkflowTemplate["nodes"][number];
  template: ProductWorkflowTemplate;
};

type NodeAgentListPanelProps = {
  activeStudioTab: NodeAgentStudioTab;
  filteredBindings: NodeAgentBinding[];
  nodeAgentRuntimeFilter: "all" | "ai" | "system";
  nodeAgentSearchQuery: string;
  onConfigureModel: () => void;
  onSelectBinding: (key: string) => void;
  onSetActiveStudioTab: (tab: NodeAgentStudioTab) => void;
  onSetRuntimeFilter: (value: "all" | "ai" | "system") => void;
  onSetSearchQuery: (value: string) => void;
  selectedNodeAgentKey: string;
};

export function NodeAgentListPanel({
  activeStudioTab,
  filteredBindings,
  nodeAgentRuntimeFilter,
  nodeAgentSearchQuery,
  onConfigureModel,
  onSelectBinding,
  onSetActiveStudioTab,
  onSetRuntimeFilter,
  onSetSearchQuery,
  selectedNodeAgentKey
}: NodeAgentListPanelProps) {
  return (
    <aside className="node-agent-studio__list" aria-label="节点智能体列表">
      <button className="node-agent-studio__model-bar" onClick={onConfigureModel} type="button">
        配置模型与 API Key
      </button>

      <div className="node-agent-studio__tabs" role="tablist">
        {([
          ["configure", "编排"],
          ["debug", "调试"],
          ["versions", "版本"]
        ] as const).map(([id, label]) => (
          <button
            aria-selected={activeStudioTab === id}
            className={`node-agent-studio__tab${activeStudioTab === id ? " is-active" : ""}`}
            key={id}
            onClick={() => onSetActiveStudioTab(id)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <label className="node-agent-studio__search">
        <span>搜索节点</span>
        <input
          onChange={(event) => onSetSearchQuery(event.target.value)}
          placeholder="模板 / 节点 / 智能体"
          value={nodeAgentSearchQuery}
        />
      </label>

      <div className="node-agent-studio__filters" aria-label="执行方式筛选">
        {([
          ["all", "全部"],
          ["ai", "AI"],
          ["system", "系统"]
        ] as const).map(([value, label]) => (
          <button
            className={`filter-chip${nodeAgentRuntimeFilter === value ? " is-active" : ""}`}
            key={value}
            onClick={() => onSetRuntimeFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="node-agent-studio__bindings scroll-area">
        <SelectableCardList
          ariaLabel="节点智能体绑定"
          empty={<p className="node-agent-studio__empty">没有匹配的节点智能体</p>}
          items={filteredBindings.map(({ application, node, template }) => {
            const key = `${template.id}-${node.id}`;
            return {
              id: key,
              title: node.title,
              description: template.name,
              meta: `${application?.name ?? "未绑定智能体"} · ${meetingNodeKindLabels[node.kind]}`
            };
          })}
          layout="stack"
          onSelect={onSelectBinding}
          selectedId={selectedNodeAgentKey || null}
        />
      </div>
    </aside>
  );
}

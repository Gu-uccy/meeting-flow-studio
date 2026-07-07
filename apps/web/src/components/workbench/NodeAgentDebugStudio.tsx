import { useMemo } from "react";
import type {
  AiApplication,
  AiApplicationInputField,
  AiApplicationPromptConfig,
  MeetingRecordWithPermissions,
  ProductNodeRun,
  ProductWorkflowNode,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";
import { useKnowledgeRetrieval } from "../../hooks/useKnowledgeRetrieval";
import { getKnowledgeConfigFromNode } from "../../lib/knowledgeConfig";
import {
  buildRetrievalQuery,
  formatContextPackText,
  previewNodeAgentPrompts
} from "../../lib/promptPreview";
import { NodeAgentDebugTrace } from "./NodeAgentDebugTrace";

type MappingVariableOption = { group: string; label: string; value: string };
type PromptVariableGroup = { group: string; options: MappingVariableOption[] };

type NodeAgentDebugStudioProps = {
  app: AiApplication;
  appId: string;
  debugSession: { applicationId: string; inputs: Record<string, unknown>; run: ProductWorkflowRun } | null;
  getAppInputValue: (field: AiApplicationInputField) => string;
  inputSchema: AiApplicationInputField[];
  isRunning: boolean;
  isWorkflowMutating: boolean;
  lastNodeRun?: ProductNodeRun;
  meeting: MeetingRecordWithPermissions | null;
  node: ProductWorkflowNode;
  onAppendVariable: (target: "systemPrompt" | "userPrompt", variable: string) => void;
  onDebugWorkflow: () => void | Promise<void>;
  onInputChange: (fieldKey: string, value: string) => void;
  onPromptChange: <K extends keyof AiApplicationPromptConfig>(key: K, value: AiApplicationPromptConfig[K]) => void;
  onRunPrompt: () => void | Promise<void>;
  onSavePrompt: () => void;
  onTogglePublish: () => void;
  promptConfig: AiApplicationPromptConfig;
  template: ProductWorkflowTemplate | null;
  variableGroups: PromptVariableGroup[];
};

function stringifyOutput(payload?: ProductNodeRun["outputPayload"]) {
  if (!payload || Object.keys(payload).length === 0) {
    return "运行后将在此显示节点输出。";
  }

  return JSON.stringify(payload, null, 2);
}

function appendVariableGroup(groups: PromptVariableGroup[], group: string, options: MappingVariableOption[]) {
  if (options.length === 0) {
    return groups;
  }

  return [...groups, { group, options }];
}

export function NodeAgentDebugStudio(props: NodeAgentDebugStudioProps) {
  const {
    app,
    appId,
    debugSession,
    getAppInputValue,
    inputSchema,
    isRunning,
    isWorkflowMutating,
    lastNodeRun,
    meeting,
    node,
    onAppendVariable,
    onDebugWorkflow,
    onInputChange,
    onPromptChange,
    onRunPrompt,
    onSavePrompt,
    onTogglePublish,
    promptConfig,
    template,
    variableGroups
  } = props;

  const retrievalQuery = buildRetrievalQuery(meeting);
  const knowledgeConfig = useMemo(() => getKnowledgeConfigFromNode(node), [node]);
  const knowledgeRetrieval = useKnowledgeRetrieval(meeting?.id ?? "", Boolean(meeting), retrievalQuery, knowledgeConfig);
  const previewInputs = Object.fromEntries(inputSchema.map((field) => [field.key, getAppInputValue(field)]));
  const preview = previewNodeAgentPrompts(promptConfig, node, meeting, previewInputs, knowledgeRetrieval.retrieval);

  const extendedVariableGroups = useMemo(
    () =>
      appendVariableGroup(variableGroups, "Knowledge Retrieval", [
        { group: "Knowledge Retrieval", label: "上下文正文", value: "input.contextPackText" },
        { group: "Knowledge Retrieval", label: "Citation 列表", value: "input.citations" },
        { group: "Knowledge Retrieval", label: "检索模式", value: "retrieval.mode" },
        { group: "Knowledge Retrieval", label: "最高相似度", value: "retrieval.topSimilarity" }
      ]),
    [variableGroups]
  );

  const contextPreview = formatContextPackText(knowledgeRetrieval.retrieval?.contextPack);
  const retrievalMeta = knowledgeRetrieval.retrieval?.retrievalMode
    ? `${knowledgeRetrieval.retrieval.retrievalMode}${knowledgeRetrieval.retrieval.embeddingModel ? ` · ${knowledgeRetrieval.retrieval.embeddingModel}` : ""}`
    : "暂无检索";

  async function handleRunPrompt() {
    await onRunPrompt();
    await knowledgeRetrieval.reload();
  }

  return (
    <section className="node-agent-prompt-editor node-agent-playground node-agent-debug-studio" aria-label="调试 Playground">
      <div className="node-agent-editor__section-title">
        <span>调试 Playground</span>
        <div className="node-agent-editor__section-actions">
          <button
            className="ghost-button"
            disabled={isWorkflowMutating || knowledgeRetrieval.isLoading || !meeting}
            onClick={() => void knowledgeRetrieval.reload()}
            type="button"
          >
            {knowledgeRetrieval.isLoading ? "检索中..." : "刷新向量上下文"}
          </button>
          <button className="ghost-button" disabled={isWorkflowMutating || isRunning || !meeting} onClick={() => void handleRunPrompt()} type="button">
            {isRunning ? "运行中..." : "试运行"}
          </button>
          <button className="ghost-button" disabled={!template || !meeting || isWorkflowMutating} onClick={() => void onDebugWorkflow()} type="button">
            调试工作流
          </button>
          <button className="ghost-button" disabled={isWorkflowMutating} onClick={onSavePrompt} type="button">保存 Prompt</button>
          <button className="ghost-button" disabled={isWorkflowMutating} onClick={onTogglePublish} type="button">
            {app.status === "published" ? "下线" : "发布"}
          </button>
        </div>
      </div>

      {inputSchema.length > 0 ? (
        <div className="node-agent-debug-studio__inputs app-input-schema" aria-label="试运行输入变量">
          {inputSchema.slice(0, 8).map((field) => (
            <label className="app-input-field" key={field.key}>
              <span>{field.label}{field.required ? " *" : ""}</span>
              {field.type === "textarea" || field.type === "json" ? (
                <textarea onChange={(event) => onInputChange(field.key, event.target.value)} value={getAppInputValue(field)} />
              ) : (
                <input
                  onChange={(event) => onInputChange(field.key, event.target.value)}
                  type={field.type === "number" ? "number" : "text"}
                  value={getAppInputValue(field)}
                />
              )}
              {field.description ? <small>{field.description}</small> : null}
            </label>
          ))}
        </div>
      ) : null}

      <div className="node-agent-playground__grid">
        <aside className="node-agent-prompt-variables node-agent-playground__variables">
          <strong>变量面板</strong>
          <p>向量检索结果会注入 `input.contextPackText` 等变量，右侧 Prompt 预览实时渲染。</p>
          {extendedVariableGroups.map((group) => (
            <section className="node-agent-prompt-variable-group" key={`${appId}-${group.group}`}>
              <strong>{group.group}</strong>
              <div className="node-agent-prompt-variable-list">
                {group.options.map((option) => (
                  <div className="node-agent-prompt-variable-chip" key={`${group.group}-${option.value}`}>
                    <div className="node-agent-prompt-variable-chip__main">
                      <code>{`{{${option.value}}}`}</code>
                      <span>{option.label}</span>
                    </div>
                    <div className="node-agent-prompt-variable-chip__actions">
                      <button className="ghost-button" onClick={() => onAppendVariable("userPrompt", option.value)} type="button">User</button>
                      <button className="ghost-button" onClick={() => onAppendVariable("systemPrompt", option.value)} type="button">System</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <div className="node-agent-playground__editor">
          <label>
            <span>System Prompt</span>
            <textarea onChange={(event) => onPromptChange("systemPrompt", event.target.value)} value={promptConfig.systemPrompt} />
          </label>
          <label>
            <span>User Prompt</span>
            <textarea onChange={(event) => onPromptChange("userPrompt", event.target.value)} value={promptConfig.userPrompt} />
          </label>
          <div className="node-agent-prompt-grid">
            <label><span>模型</span><input onChange={(event) => onPromptChange("model", event.target.value)} value={promptConfig.model} /></label>
            <label><span>Temperature</span><input max={1} min={0} onChange={(event) => onPromptChange("temperature", Number(event.target.value))} step={0.1} type="number" value={promptConfig.temperature} /></label>
            <label><span>Max Tokens</span><input max={8000} min={128} onChange={(event) => onPromptChange("maxTokens", Number(event.target.value))} step={128} type="number" value={promptConfig.maxTokens} /></label>
          </div>
        </div>

        <aside className="node-agent-playground__preview">
          <strong>渲染预览</strong>
          <article className="app-debug-panel">
            <div className="app-debug-panel__title">
              <span>向量检索上下文</span>
              <strong>{retrievalMeta}</strong>
            </div>
            {knowledgeRetrieval.error ? <pre className="is-error">{knowledgeRetrieval.error}</pre> : null}
            {!knowledgeRetrieval.error && (
              <pre>{knowledgeRetrieval.isLoading ? "正在加载向量检索结果..." : contextPreview || "暂无检索结果，请先运行流程沉淀记忆或刷新向量上下文。"}</pre>
            )}
          </article>
          <article className="app-debug-panel">
            <div className="app-debug-panel__title"><span>System</span><strong>{preview.systemPrompt ? "已渲染" : "空"}</strong></div>
            <pre>{preview.systemPrompt || "（空）"}</pre>
          </article>
          <article className="app-debug-panel">
            <div className="app-debug-panel__title"><span>User</span><strong>{preview.userPrompt ? "已渲染" : "空"}</strong></div>
            <pre>{preview.userPrompt || "（空）"}</pre>
          </article>
          <article className="app-debug-panel">
            <div className="app-debug-panel__title"><span>最近运行输出</span><strong>{lastNodeRun ? "有输出" : "待运行"}</strong></div>
            <pre>{stringifyOutput(lastNodeRun?.outputPayload)}</pre>
          </article>
        </aside>
      </div>

      {debugSession && debugSession.applicationId === appId ? (
        <NodeAgentDebugTrace
          app={app}
          inputs={debugSession.inputs}
          meeting={meeting}
          run={debugSession.run}
          template={template}
        />
      ) : null}
    </section>
  );
}

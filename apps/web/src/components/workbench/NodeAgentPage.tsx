import { useState } from "react";
import {
  meetingNodeKindLabels,
  type AiApplicationInputField,
  type AiApplicationOutputField,
  type AiApplicationPromptConfig,
  type MeetingRecordWithPermissions,
  type ProductNodeRun,
  type ProductWorkflowNodeExecutor,
  type ProductWorkflowRun,
} from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";
import { formatDateTime } from "../../lib/format";
import { useWorkbench } from "../../contexts/WorkbenchContext";

// ── Types ──

type MappingRow = { source: string; target: string };
type NodeAgentMappingDraft = { inputMapping: MappingRow[]; outputMapping: MappingRow[] };
type NodeAgentSchemaDraft = { inputSchema: AiApplicationInputField[]; outputSchema: AiApplicationOutputField[] };
type NodeAgentPromptDraft = AiApplicationPromptConfig;

type MappingVariableOption = { group: string; label: string; value: string };
type PromptVariableGroup = { group: string; options: MappingVariableOption[] };

const aiApplicationInputTypes: AiApplicationInputField["type"][] = ["text", "textarea", "number", "select", "json", "boolean"];
const aiApplicationOutputTypes: AiApplicationOutputField["type"][] = ["text", "json", "number", "boolean"];

const meetingMappingVariableOptions: MappingVariableOption[] = [
  { group: "会议字段", label: "会议 ID", value: "meeting.meetingId" },
  { group: "会议字段", label: "会议标题", value: "meeting.title" },
  { group: "会议字段", label: "会议类型", value: "meeting.type" },
  { group: "会议字段", label: "优先级", value: "meeting.priority" },
  { group: "会议字段", label: "会议目标", value: "meeting.meetingGoal" },
  { group: "会议字段", label: "参会人", value: "meeting.participants" },
  { group: "会议字段", label: "参会人数", value: "meeting.attendeeCount" },
];

// ── Helpers ──

function objectToMappingRows(value: Record<string, string> | undefined): MappingRow[] {
  return Object.entries(value ?? {}).map(([source, target]) => ({ source, target }));
}

function mappingRowsToObject(rows: MappingRow[]) {
  return Object.fromEntries(rows.map((r) => [r.source.trim(), r.target.trim()] as const).filter(([s]) => Boolean(s)));
}

function stringifyTracePayload(payload?: ProductNodeRun["inputPayload"] | ProductNodeRun["outputPayload"]) {
  if (!payload || Object.keys(payload).length === 0) return "{}";
  return JSON.stringify(payload, null, 2);
}

function formatNodeRunDuration(nodeRun: ProductNodeRun) {
  if (!nodeRun.startedAt || !nodeRun.endedAt) return "未结束";
  const durationMs = new Date(nodeRun.endedAt).getTime() - new Date(nodeRun.startedAt).getTime();
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

function formatNodeRunWindow(nodeRun: ProductNodeRun) {
  if (!nodeRun.startedAt) return "尚未开始";
  return nodeRun.endedAt ? `${formatDateTime(nodeRun.startedAt)} - ${formatDateTime(nodeRun.endedAt)}` : formatDateTime(nodeRun.startedAt);
}

function getDefaultAppInputValue(field: AiApplicationInputField, meeting?: MeetingRecordWithPermissions | null) {
  if (!meeting) return field.defaultValue;
  if (field.key === "meetingId") return meeting.id;
  if (field.key === "meetingGoal") return meeting.meetingGoal;
  if (field.key === "priority") return meeting.priority;
  if (field.key === "participants") return JSON.stringify(meeting.participants.map((p) => p.name));
  const value = meeting[field.key as keyof MeetingRecordWithPermissions];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : field.defaultValue;
}

function groupMappingVariableOptions(options: MappingVariableOption[]) {
  return options.reduce<PromptVariableGroup[]>((groups, option) => {
    const existing = groups.find((g) => g.group === option.group);
    if (existing) { existing.options.push(option); } else { groups.push({ group: option.group, options: [option] }); }
    return groups;
  }, []);
}

// ── Component ──

export function NodeAgentPage() {
  const {
    derived,
    meetings,
    memories,
    setWorkbenchView,
    workflow
  } = useWorkbench();

  const aiApplications = workflow.applications;
  const filteredMeetings = meetings.filteredMeetings;
  const isWorkflowMutating = workflow.isMutating;
  const modelRuntimeLabel = derived.modelRuntimeLabel;
  const nodeCapabilities = workflow.nodeCapabilities;
  const selectedMeeting = meetings.selectedMeeting;
  const workflowTemplates = workflow.templates;
  const onApplyApplicationVersion = workflow.applyApplicationVersion;
  const onCreateApplicationVersion = workflow.createApplicationVersion;
  const onDebugApplication = workflow.debugApplication;
  const onReloadMemories = memories.reloadMemories;
  const onSaveNodeExecutor = workflow.saveNodeExecutor;
  const onStartWorkflowRun = workflow.startWorkflowRun;
  const onUpdateApplicationPromptConfig = workflow.updateApplicationPromptConfig;
  const onUpdateApplicationSchema = workflow.updateApplicationSchema;
  const onUpdateApplicationStatus = workflow.updateApplicationStatus;
  const onNavigateToAccount = () => setWorkbenchView("account");

  const [nodeAgentSearchQuery, setNodeAgentSearchQuery] = useState("");
  const [nodeAgentRuntimeFilter, setNodeAgentRuntimeFilter] = useState<"all" | "ai" | "system">("all");
  const [selectedNodeAgentKey, setSelectedNodeAgentKey] = useState("");
  const [nodeAgentMappingDrafts, setNodeAgentMappingDrafts] = useState<Record<string, NodeAgentMappingDraft>>({});
  const [nodeAgentSchemaDrafts, setNodeAgentSchemaDrafts] = useState<Record<string, NodeAgentSchemaDraft>>({});
  const [nodeAgentPromptDrafts, setNodeAgentPromptDrafts] = useState<Record<string, NodeAgentPromptDraft>>({});
  const [appInputDrafts, setAppInputDrafts] = useState<Record<string, Record<string, string>>>({});
  const [debugSession, setDebugSession] = useState<{ applicationId: string; inputs: Record<string, unknown>; run: ProductWorkflowRun } | null>(null);

  const nodeAgentApplications = aiApplications.filter((a) => a.source === "node");
  const nodeAgentBindings = workflowTemplates.flatMap((template) =>
    template.nodes.map((node) => {
      const application = node.executor?.applicationId ? nodeAgentApplications.find((a) => a.id === node.executor?.applicationId) : null;
      return { application, node, template };
    })
  );
  const aiBackedNodeBindings = nodeAgentBindings.filter((b) => b.node.executor?.type === "aiApplication");

  const normalizedQuery = nodeAgentSearchQuery.trim().toLowerCase();
  const filteredNodeAgentBindings = nodeAgentBindings.filter(({ application, node, template }) => {
    const matchesRuntime = nodeAgentRuntimeFilter === "all" || (nodeAgentRuntimeFilter === "ai" && node.executor?.type === "aiApplication") || (nodeAgentRuntimeFilter === "system" && node.executor?.type !== "aiApplication");
    const searchTarget = [application?.name, application?.entrypoint, node.description, node.id, node.title, template.name, meetingNodeKindLabels[node.kind]].filter(Boolean).join(" ").toLowerCase();
    return matchesRuntime && (!normalizedQuery || searchTarget.includes(normalizedQuery));
  });

  const selectedBinding = filteredNodeAgentBindings.find(({ node, template }) => `${template.id}-${node.id}` === selectedNodeAgentKey) ?? filteredNodeAgentBindings[0] ?? nodeAgentBindings[0] ?? null;
  const selectedApp = selectedBinding?.application ?? null;
  const selectedNode = selectedBinding?.node ?? null;
  const selectedTemplate = selectedBinding?.template ?? null;
  const selectedExecutor = selectedNode?.executor ?? null;

  const activeDebugApp = debugSession ? aiApplications.find((a) => a.id === debugSession.applicationId) : null;
  const activeDebugTemplate = activeDebugApp ? workflowTemplates.find((t) => t.id === activeDebugApp.templateId) : null;
  const activeDebugMeeting = debugSession ? filteredMeetings.find((m) => m.id === debugSession.run.meetingId) : null;

  function getBindingKey() { return selectedBinding ? `${selectedBinding.template.id}-${selectedBinding.node.id}` : ""; }
  function getAppInputValue(appId: string, field: AiApplicationInputField) { return appInputDrafts[appId]?.[field.key] ?? getDefaultAppInputValue(field, selectedMeeting); }
  function getSchemaFields(appId: string, type: "inputSchema" | "outputSchema"): AiApplicationInputField[] | AiApplicationOutputField[] {
    const fallback = type === "inputSchema" ? selectedApp?.inputSchema ?? [] : selectedApp?.outputSchema ?? [];
    return nodeAgentSchemaDrafts[appId]?.[type] ?? fallback;
  }
  function getEditableInputSchema(appId: string) { return getSchemaFields(appId, "inputSchema") as AiApplicationInputField[]; }
  function getEditableOutputSchema(appId: string) { return getSchemaFields(appId, "outputSchema") as AiApplicationOutputField[]; }
  function getEditablePromptConfig(appId: string) { return nodeAgentPromptDrafts[appId] ?? selectedApp?.promptConfig; }

  function setSchemaFields(appId: string, type: "inputSchema" | "outputSchema", fields: AiApplicationInputField[] | AiApplicationOutputField[]) {
    setNodeAgentSchemaDrafts((prev) => ({
      ...prev,
      [appId]: {
        inputSchema: type === "inputSchema" ? (fields as AiApplicationInputField[]) : prev[appId]?.inputSchema ?? selectedApp?.inputSchema ?? [],
        outputSchema: type === "outputSchema" ? (fields as AiApplicationOutputField[]) : prev[appId]?.outputSchema ?? selectedApp?.outputSchema ?? [],
      },
    }));
  }

  function setPromptConfigField<K extends keyof AiApplicationPromptConfig>(appId: string, key: K, value: AiApplicationPromptConfig[K]) {
    const fallback = selectedApp?.promptConfig;
    if (!fallback) return;
    setNodeAgentPromptDrafts((prev) => ({ ...prev, [appId]: { ...(prev[appId] ?? fallback), [key]: value } }));
  }

  function getMappingRows(key: string, type: "inputMapping" | "outputMapping"): MappingRow[] {
    const fallback = type === "inputMapping" ? objectToMappingRows(selectedExecutor?.inputMapping) : objectToMappingRows(selectedExecutor?.outputMapping);
    return nodeAgentMappingDrafts[key]?.[type] ?? fallback;
  }

  function setMappingRows(key: string, type: "inputMapping" | "outputMapping", rows: MappingRow[]) {
    setNodeAgentMappingDrafts((prev) => ({
      ...prev,
      [key]: {
        inputMapping: type === "inputMapping" ? rows : prev[key]?.inputMapping ?? objectToMappingRows(selectedExecutor?.inputMapping),
        outputMapping: type === "outputMapping" ? rows : prev[key]?.outputMapping ?? objectToMappingRows(selectedExecutor?.outputMapping),
      },
    }));
  }

  function buildMappingRowsFromSchema(type: "inputMapping" | "outputMapping"): MappingRow[] {
    if (!selectedApp || !selectedNode) return [];
    if (type === "inputMapping") return getEditableInputSchema(selectedApp.id).map((f) => ({ source: f.key, target: `meeting.${f.key}` }));
    return getEditableOutputSchema(selectedApp.id).map((f) => ({ source: f.key, target: `node.${selectedNode.id}.${f.key}` }));
  }

  async function saveSelectedNodeExecutor(nextExecutor: ProductWorkflowNodeExecutor) {
    if (!selectedTemplate || !selectedNode) return null;
    return onSaveNodeExecutor(selectedTemplate.id, selectedNode.id, nextExecutor);
  }

  async function saveSelectedNodeMappings() {
    if (!selectedExecutor) return null;
    const key = getBindingKey();
    return saveSelectedNodeExecutor({ ...selectedExecutor, inputMapping: mappingRowsToObject(getMappingRows(key, "inputMapping")), outputMapping: mappingRowsToObject(getMappingRows(key, "outputMapping")) });
  }

  async function saveSelectedNodeSchema() {
    if (!selectedApp) return null;
    return onUpdateApplicationSchema(selectedApp.id, getEditableInputSchema(selectedApp.id), getEditableOutputSchema(selectedApp.id));
  }

  async function saveSelectedNodePromptConfig() {
    if (!selectedApp) return null;
    const config = getEditablePromptConfig(selectedApp.id);
    if (!config) return null;
    return onUpdateApplicationPromptConfig(selectedApp.id, config);
  }

  async function saveSelectedNodeVersion(status: "snapshot" | "published") {
    if (!selectedApp) return null;
    await saveSelectedNodeMappings();
    await saveSelectedNodeSchema();
    await saveSelectedNodePromptConfig();
    return onCreateApplicationVersion(selectedApp.id, status, status === "published" ? "发布当前节点智能体配置" : "保存当前节点智能体配置快照");
  }

  const inputMappings = Object.entries(selectedBinding?.node.executor?.inputMapping ?? {});
  const outputMappings = Object.entries(selectedBinding?.node.executor?.outputMapping ?? {});

  return (
    <>
      <section className="app-hub" aria-label="节点智能体管理">
        <div className="app-hub__header">
          <div>
            <span className="section-kicker">Mini Dify Layer</span>
            <h2>节点智能体管理</h2>
            <p>把会议流程节点绑定为可复用、可调试、可通过 API 运行的智能体执行器。</p>
          </div>
          <button className="ghost-button" onClick={onNavigateToAccount} type="button">配置模型</button>
        </div>

        <div className="app-hub__summary" aria-label="节点智能体概览">
          <article><span>节点智能体</span><strong>{nodeAgentApplications.length}</strong></article>
          <article><span>已绑定节点</span><strong>{aiBackedNodeBindings.length}/{nodeAgentBindings.length}</strong></article>
          <article><span>模型运行时</span><strong>{modelRuntimeLabel}</strong></article>
        </div>

        <div className="node-agent-manager" aria-label="节点智能体搜索列表">
          <aside className="node-agent-list-panel">
            <div className="section-title">
              <span>Agent Queue</span><h3>节点列表</h3>
              <p>按流程节点检索、筛选并选择要管理的智能体执行器。</p>
            </div>
            <label className="node-agent-search">
              <span>搜索</span>
              <input onChange={(e) => setNodeAgentSearchQuery(e.target.value)} placeholder="搜索节点、流程或智能体" value={nodeAgentSearchQuery} />
            </label>
            <div className="filter-strip" aria-label="执行方式筛选">
              {[{ label: "全部", value: "all" }, { label: "AI 执行", value: "ai" }, { label: "系统/人工", value: "system" }].map((f) => (
                <button className={`filter-chip${nodeAgentRuntimeFilter === f.value ? " is-active" : ""}`} key={f.value} onClick={() => setNodeAgentRuntimeFilter(f.value as "all" | "ai" | "system")} type="button">{f.label}</button>
              ))}
            </div>
            <div className="node-agent-list scroll-area">
              {filteredNodeAgentBindings.map(({ application, node, template }) => {
                const key = `${template.id}-${node.id}`;
                const selectedKey = selectedBinding ? `${selectedBinding.template.id}-${selectedBinding.node.id}` : "";
                return (
                  <button className={`node-agent-row${selectedKey === key ? " is-selected" : ""}`} key={key} onClick={() => setSelectedNodeAgentKey(key)} type="button">
                    <span>{template.name}</span><strong>{node.title}</strong>
                    <small>{meetingNodeKindLabels[node.kind]} / {node.executor?.type === "aiApplication" ? application?.name ?? "未绑定智能体" : node.executor?.label}</small>
                  </button>
                );
              })}
              {filteredNodeAgentBindings.length === 0 && <div className="node-agent-empty">没有匹配的节点智能体</div>}
            </div>
          </aside>

          <section className="node-agent-detail" aria-label="节点智能体详情">
            {selectedBinding && selectedNode && selectedTemplate ? (
              <>
                <div className="node-agent-detail__header">
                  <div>
                    <span>{selectedTemplate.name}</span><h3>{selectedNode.title}</h3><p>{selectedNode.description}</p>
                  </div>
                  <span className={`app-status app-status--${selectedApp?.status ?? selectedTemplate.status}`}>
                    {selectedExecutor?.type === "aiApplication" ? "AI 执行" : selectedExecutor?.type === "system" ? "系统执行" : "人工处理"}
                  </span>
                </div>

                <div className="node-agent-detail__binding">
                  <article><span>节点类型</span><strong>{meetingNodeKindLabels[selectedNode.kind]}</strong></article>
                  <article><span>绑定智能体</span><strong>{selectedApp?.name ?? selectedExecutor?.label ?? "未绑定智能体"}</strong></article>
                  <article><span>入口</span><code>{selectedApp?.entrypoint ?? selectedExecutor?.runtime ?? "manual"}</code></article>
                </div>

                {selectedExecutor && (
                  <div className="node-agent-editor" aria-label="节点智能体编辑器">
                    <label>
                      <span>执行方式</span>
                      <Dropdown<ProductWorkflowNodeExecutor["type"]>
                        ariaLabel="执行方式" disabled={isWorkflowMutating}
                        onChange={(value) => void saveSelectedNodeExecutor({
                          ...selectedExecutor,
                          applicationId: value === "aiApplication" ? selectedExecutor.applicationId || selectedApp?.id || `agent-${selectedTemplate.id.replace(/^template-/, "")}-${selectedNode.id}` : undefined,
                          label: value === "aiApplication" ? "节点智能体" : value === "system" ? "系统执行器" : "人工处理",
                          runtime: value === "aiApplication" ? "agent" : value === "system" ? "system" : "human",
                          type: value,
                        })}
                        options={[{ label: "AI 执行", value: "aiApplication" }, { label: "系统执行", value: "system" }, { label: "人工处理", value: "manual" }]}
                        value={selectedExecutor.type}
                      />
                    </label>

                    {/* Mapping editors */}
                    {(["inputMapping", "outputMapping"] as const).map((mappingType) => {
                      const mappingKey = getBindingKey();
                      const rows = getMappingRows(mappingKey, mappingType);
                      return (
                        <section className="node-agent-map-editor" key={mappingType}>
                          <div className="node-agent-editor__section-title">
                            <span>{mappingType === "inputMapping" ? "Input Mapping" : "Output Mapping"}</span>
                            <div className="node-agent-editor__section-actions">
                              <button className="ghost-button" disabled={!selectedApp} onClick={() => { const k = getBindingKey(); if (k) setMappingRows(k, mappingType, buildMappingRowsFromSchema(mappingType)); }} type="button">按 Schema 生成</button>
                              <button className="ghost-button" onClick={() => setMappingRows(mappingKey, mappingType, [...rows, { source: "", target: "" }])} type="button">+ 新增</button>
                            </div>
                          </div>
                          {rows.map((row, i) => (
                            <div className="node-agent-map-row" key={`${mappingType}-${i}`}>
                              <input aria-label="source" onChange={(e) => setMappingRows(mappingKey, mappingType, rows.map((r, j) => j === i ? { ...r, source: e.target.value } : r))} placeholder="source" value={row.source} />
                              <input aria-label="target" onChange={(e) => setMappingRows(mappingKey, mappingType, rows.map((r, j) => j === i ? { ...r, target: e.target.value } : r))} placeholder="target" value={row.target} />
                              <button className="ghost-button" onClick={() => setMappingRows(mappingKey, mappingType, rows.filter((_, j) => j !== i))} type="button">删除</button>
                            </div>
                          ))}
                          {rows.length === 0 && <div className="node-agent-inline-empty">暂无映射</div>}
                        </section>
                      );
                    })}
                    <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeMappings()} type="button">保存映射</button>
                  </div>
                )}

                <div className="node-agent-card__maps">
                  <div><span>Input Mapping</span>{inputMappings.length > 0 ? inputMappings.map(([s, t]) => <code key={s}>{s} -&gt; {t}</code>) : <code>no inputs</code>}</div>
                  <div><span>Output Mapping</span>{outputMappings.length > 0 ? outputMappings.map(([s, t]) => <code key={s}>{s} -&gt; {t}</code>) : <code>no outputs</code>}</div>
                </div>

                {selectedApp && (
                  <>
                    {/* Input preview */}
                    <div className="app-input-schema" aria-label="节点智能体输入变量">
                      {getEditableInputSchema(selectedApp.id).slice(0, 4).map((field) => (
                        <label className="app-input-field" key={field.key}>
                          <span>{field.label}{field.required ? " *" : ""}</span>
                          {field.type === "textarea" || field.type === "json" ? (
                            <textarea onChange={(e) => setAppInputDrafts((c) => ({ ...c, [selectedApp.id]: { ...c[selectedApp.id], [field.key]: e.target.value } }))} value={getAppInputValue(selectedApp.id, field)} />
                          ) : (
                            <input onChange={(e) => setAppInputDrafts((c) => ({ ...c, [selectedApp.id]: { ...c[selectedApp.id], [field.key]: e.target.value } }))} type={field.type === "number" ? "number" : "text"} value={getAppInputValue(selectedApp.id, field)} />
                          )}
                          <small>{field.description}</small>
                        </label>
                      ))}
                    </div>

                    {/* Schema editor */}
                    <div className="node-agent-schema-editor" aria-label="节点智能体 Schema 编辑器">
                      <div className="node-agent-editor__section-title">
                        <span>Input Schema</span>
                        <button className="ghost-button" onClick={() => setSchemaFields(selectedApp.id, "inputSchema", [...getEditableInputSchema(selectedApp.id), { key: `input_${Date.now()}`, label: "New Input", type: "text", required: false, description: "", defaultValue: "" }])} type="button">+ 新增输入</button>
                      </div>
                      {getEditableInputSchema(selectedApp.id).map((field, i) => {
                        const fields = getEditableInputSchema(selectedApp.id);
                        const updateField = (patch: Partial<AiApplicationInputField>) => setSchemaFields(selectedApp.id, "inputSchema", fields.map((f, j) => j === i ? { ...f, ...patch } : f));
                        return (
                          <div className="node-agent-schema-row" key={`${field.key}-${i}`}>
                            <input aria-label="key" onChange={(e) => updateField({ key: e.target.value })} placeholder="key" value={field.key} />
                            <input aria-label="label" onChange={(e) => updateField({ label: e.target.value })} placeholder="label" value={field.label} />
                            <Dropdown ariaLabel="type" onChange={(v) => updateField({ type: v })} options={aiApplicationInputTypes.map((t) => ({ label: t, value: t }))} value={field.type} />
                            <label className="node-agent-toggle-row"><input checked={field.required} onChange={(e) => updateField({ required: e.target.checked })} type="checkbox" />必填</label>
                            <input aria-label="default value" onChange={(e) => updateField({ defaultValue: e.target.value })} placeholder="default" value={field.defaultValue} />
                            <input aria-label="description" onChange={(e) => updateField({ description: e.target.value })} placeholder="description" value={field.description} />
                            <button className="ghost-button" onClick={() => setSchemaFields(selectedApp.id, "inputSchema", fields.filter((_, j) => j !== i))} type="button">删除</button>
                          </div>
                        );
                      })}

                      <div className="node-agent-editor__section-title">
                        <span>Output Schema</span>
                        <button className="ghost-button" onClick={() => setSchemaFields(selectedApp.id, "outputSchema", [...getEditableOutputSchema(selectedApp.id), { key: `output_${Date.now()}`, label: "New Output", type: "json", description: "" }])} type="button">+ 新增输出</button>
                      </div>
                      {getEditableOutputSchema(selectedApp.id).map((field, i) => {
                        const fields = getEditableOutputSchema(selectedApp.id);
                        const updateField = (patch: Partial<AiApplicationOutputField>) => setSchemaFields(selectedApp.id, "outputSchema", fields.map((f, j) => j === i ? { ...f, ...patch } : f));
                        return (
                          <div className="node-agent-schema-row node-agent-schema-row--output" key={`${field.key}-${i}`}>
                            <input aria-label="key" onChange={(e) => updateField({ key: e.target.value })} placeholder="key" value={field.key} />
                            <input aria-label="label" onChange={(e) => updateField({ label: e.target.value })} placeholder="label" value={field.label} />
                            <Dropdown ariaLabel="type" onChange={(v) => updateField({ type: v })} options={aiApplicationOutputTypes.map((t) => ({ label: t, value: t }))} value={field.type} />
                            <input aria-label="description" onChange={(e) => updateField({ description: e.target.value })} placeholder="description" value={field.description} />
                            <button className="ghost-button" onClick={() => setSchemaFields(selectedApp.id, "outputSchema", fields.filter((_, j) => j !== i))} type="button">删除</button>
                          </div>
                        );
                      })}
                      <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeSchema()} type="button">保存 Schema</button>
                    </div>

                    {/* Prompt editor */}
                    {(() => {
                      const config = getEditablePromptConfig(selectedApp.id);
                      if (!config) return null;
                      return (
                        <div className="node-agent-prompt-editor" aria-label="节点智能体 Prompt 配置">
                          <div className="node-agent-editor__section-title">
                            <span>Prompt</span>
                            <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodePromptConfig()} type="button">保存 Prompt</button>
                          </div>
                          <label><span>System Prompt</span><textarea onChange={(e) => setPromptConfigField(selectedApp.id, "systemPrompt", e.target.value)} value={config.systemPrompt} /></label>
                          <label><span>User Prompt</span><textarea onChange={(e) => setPromptConfigField(selectedApp.id, "userPrompt", e.target.value)} value={config.userPrompt} /></label>
                          <div className="node-agent-prompt-grid">
                            <label><span>模型</span><input onChange={(e) => setPromptConfigField(selectedApp.id, "model", e.target.value)} value={config.model} /></label>
                            <label><span>Temperature</span><input max={1} min={0} onChange={(e) => setPromptConfigField(selectedApp.id, "temperature", Number(e.target.value))} step={0.1} type="number" value={config.temperature} /></label>
                            <label><span>Max Tokens</span><input max={8000} min={128} onChange={(e) => setPromptConfigField(selectedApp.id, "maxTokens", Number(e.target.value))} step={128} type="number" value={config.maxTokens} /></label>
                          </div>
                          <div className="node-agent-prompt-variables" aria-label="运行时变量">
                            <div className="node-agent-editor__section-title"><span>运行时变量</span></div>
                            {groupMappingVariableOptions([...meetingMappingVariableOptions, ...getEditableInputSchema(selectedApp.id).map((f) => ({ group: "Input Schema", label: f.label || f.key, value: `input.${f.key}` })), ...(selectedNode ? [{ group: "当前节点", label: "节点 ID", value: "node.id" }, { group: "当前节点", label: "节点名称", value: "node.title" }, { group: "当前节点", label: "节点类型", value: "node.kind" }] : [])]).map((g) => (
                              <section className="node-agent-prompt-variable-group" key={g.group}>
                                <strong>{g.group}</strong>
                                <div className="node-agent-prompt-variable-list">
                                  {g.options.map((o) => (
                                    <div className="node-agent-prompt-variable-chip" key={`${g.group}-${o.value}`}>
                                      <code>{`{{${o.value}}}`}</code><span>{o.label}</span>
                                      <button className="ghost-button" onClick={() => { const c = getEditablePromptConfig(selectedApp.id); if (c) setPromptConfigField(selectedApp.id, "userPrompt", `${c.userPrompt}${c.userPrompt.trim() ? "\n" : ""}{{${o.value}}}`); }} type="button">User</button>
                                      <button className="ghost-button" onClick={() => { const c = getEditablePromptConfig(selectedApp.id); if (c) setPromptConfigField(selectedApp.id, "systemPrompt", `${c.systemPrompt}${c.systemPrompt.trim() ? "\n" : ""}{{${o.value}}}`); }} type="button">System</button>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Version panel */}
                    <div className="node-agent-version-panel" aria-label="节点智能体版本记录">
                      <div className="node-agent-editor__section-title">
                        <span>版本记录</span>
                        <div className="node-agent-editor__section-actions">
                          <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeVersion("snapshot")} type="button">保存快照</button>
                          <button className="primary-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeVersion("published")} type="button">发布版本</button>
                        </div>
                      </div>
                      <div className="node-agent-version-list">
                        {selectedApp.versions.slice(0, 5).map((version) => (
                          <article className="node-agent-version-row" key={version.id}>
                            <div>
                              <strong>{version.version}</strong>
                              <div className="node-agent-version-row__actions">
                                <span className={`app-status app-status--${version.status === "published" ? "published" : "draft"}`}>{version.status === "published" ? "已发布" : "快照"}</span>
                                <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void onApplyApplicationVersion(selectedApp.id, version.id)} type="button">设为当前</button>
                              </div>
                            </div>
                            <p>{version.summary}</p>
                            <small>{version.promptConfig.model} / {version.createdBy} / {formatDateTime(version.createdAt)}</small>
                          </article>
                        ))}
                        {selectedApp.versions.length === 0 && <div className="node-agent-inline-empty">暂无版本记录，可先保存快照或发布一个版本。</div>}
                      </div>
                    </div>
                  </>
                )}

                <div className="app-card__actions">
                  <button className="ghost-button" disabled={!selectedApp || !selectedMeeting || isWorkflowMutating} onClick={async () => {
                    if (!selectedApp || !selectedMeeting) return;
                    const result = await onDebugApplication(selectedApp.id, Object.fromEntries(getEditableInputSchema(selectedApp.id).map((f) => [f.key, getAppInputValue(selectedApp.id, f)])));
                    if (result) { setDebugSession({ applicationId: selectedApp.id, inputs: result.inputs, run: result.run }); void onReloadMemories(); }
                  }} type="button">调试节点</button>
                  <button className="ghost-button" disabled={!selectedTemplate || !selectedMeeting || isWorkflowMutating} onClick={async () => {
                    if (!selectedTemplate || !selectedMeeting) return;
                    const run = await onStartWorkflowRun(selectedMeeting.id, selectedTemplate.id);
                    if (run) { setDebugSession({ applicationId: selectedApp?.id ?? selectedTemplate.id, inputs: { meetingId: selectedMeeting.id, templateId: selectedTemplate.id }, run }); void onReloadMemories(); }
                  }} type="button">调试工作流</button>
                  <button className="ghost-button" disabled={!selectedApp || isWorkflowMutating} onClick={() => selectedApp ? void onUpdateApplicationStatus(selectedApp.id, selectedApp.status === "published" ? "draft" : "published") : undefined} type="button">
                    {selectedApp?.status === "published" ? "下线" : "发布"}
                  </button>
                </div>
              </>
            ) : (
              <div className="node-agent-empty">请选择一个流程节点</div>
            )}
          </section>
        </div>

        <div className="node-capability-strip" aria-label="节点能力矩阵">
          {nodeCapabilities.map((c) => (
            <article className={`node-capability node-capability--${c.maturity}`} key={c.kind}>
              <span>{c.difyLikeName}</span><strong>{c.name}</strong>
              <small>{c.maturity === "ready" ? "可运行" : c.maturity === "partial" ? "部分接入" : "规划中"}</small>
            </article>
          ))}
        </div>
      </section>

      {/* Debug console */}
      {debugSession && activeDebugApp && (
        <section className="app-debug-console" aria-label="应用调试台">
          <div className="app-debug-console__header">
            <div>
              <span className="section-kicker">Debug Console</span>
              <h3>{activeDebugApp.name}</h3>
              <p>{activeDebugMeeting?.title ?? debugSession.run.name} / {debugSession.run.status} / {debugSession.run.durationSeconds}s</p>
            </div>
            <span className={`run-status status-${debugSession.run.status}`}>{debugSession.run.status}</span>
          </div>
          <div className="app-debug-console__grid">
            <article className="app-debug-panel">
              <div className="app-debug-panel__title"><span>Input</span><strong>{activeDebugApp.entrypoint}</strong></div>
              <pre>{JSON.stringify(debugSession.inputs, null, 2)}</pre>
            </article>
            <article className="app-debug-panel">
              <div className="app-debug-panel__title"><span>API</span><strong>{activeDebugApp.apiEndpoint}</strong></div>
              <pre>{`curl -X POST http://127.0.0.1:8787/api/apps/${activeDebugApp.id}/debug \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ inputs: debugSession.inputs })}'`}</pre>
            </article>
          </div>
          <div className="app-debug-console__grid app-debug-console__grid--wide">
            <article className="app-debug-panel">
              <div className="app-debug-panel__title"><span>Node Trace</span><strong>{activeDebugTemplate?.nodes.length ?? debugSession.run.nodeRuns.length} nodes</strong></div>
              <div className="debug-node-list">
                {debugSession.run.nodeRuns.map((nodeRun) => {
                  const node = activeDebugTemplate?.nodes.find((n) => n.id === nodeRun.nodeId);
                  const nodeLogs = debugSession.run.logs.filter((l) => l.nodeId === nodeRun.nodeId);
                  return (
                    <article className="debug-node-row" key={nodeRun.nodeId}>
                      <div className="debug-node-row__header">
                        <div><span className={`node-state-badge node-state-badge--${nodeRun.status}`}>{nodeRun.status}</span><strong>{node?.title ?? nodeRun.nodeId}</strong></div>
                        <small>{formatNodeRunDuration(nodeRun)}</small>
                      </div>
                      <div className="debug-node-row__meta"><code>{nodeRun.nodeId}</code><span>{formatNodeRunWindow(nodeRun)}</span></div>
                      {nodeRun.errorMessage && <div className="debug-node-row__error"><span>Error</span><code>{nodeRun.errorMessage}</code></div>}
                      <div className="debug-trace-payloads">
                        <div><span>Input</span><pre>{stringifyTracePayload(nodeRun.inputPayload)}</pre></div>
                        <div><span>Output</span><pre>{stringifyTracePayload(nodeRun.outputPayload)}</pre></div>
                      </div>
                      {nodeLogs.length > 0 && <div className="debug-node-row__logs">{nodeLogs.map((l) => <code className={`debug-node-row__log debug-node-row__log--${l.level}`} key={l.id}>{l.time} / {l.message}</code>)}</div>}
                    </article>
                  );
                })}
              </div>
            </article>
            <article className="app-debug-panel">
              <div className="app-debug-panel__title"><span>Trace</span><strong>{debugSession.run.logs.length} logs</strong></div>
              <div className="debug-log-list">
                {debugSession.run.logs.map((l) => (
                  <div className={`debug-log-row debug-log-row--${l.level}`} key={l.id}><span>{l.time}</span><code>{l.nodeId ? `${l.nodeId}: ${l.message}` : l.message}</code></div>
                ))}
              </div>
            </article>
          </div>
        </section>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import {
  meetingNodeKindLabels,
  type AiApplicationInputField,
  type AiApplicationOutputField,
  type AiApplicationPromptConfig,
  type MeetingRecordWithPermissions,
  type ProductWorkflowNodeExecutor,
  type ProductWorkflowRun,
} from "@meeting-flow/shared";
import { Dropdown } from "../common/Dropdown";
import { SelectableCardList } from "../common/SelectableCardList";
import { formatDateTime } from "../../lib/format";
import { useWorkbench } from "../../contexts/WorkbenchContext";
import { useNodeAgentStore } from "../../stores/nodeAgentStore";
import { NodeAgentDebugStudio } from "./NodeAgentDebugStudio";
import { NodeAgentVersionDiffPanel } from "./NodeAgentVersionDiffPanel";
import { NodeAgentListPanel } from "./nodeAgent/NodeAgentListPanel";
import { NodeAgentStudioLayout } from "./nodeAgent/NodeAgentStudioLayout";
import { PageShell } from "./layout/PageShell";

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

function withDropdownOption(options: MappingVariableOption[], value: string): MappingVariableOption[] {
  if (!value.trim()) {
    return options;
  }

  if (options.some((option) => option.value === value)) {
    return options;
  }

  return [{ group: "自定义", label: value, value }, ...options];
}

// ── Component ──

export function NodeAgentPage() {
  const {
    clearPendingNodeAgent,
    meetings,
    memories,
    pendingNodeAgentKey,
    setWorkbenchView,
    workflow
  } = useWorkbench();

  const aiApplications = workflow.applications;
  const isWorkflowMutating = workflow.isMutating;
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

  const [isPromptRunning, setIsPromptRunning] = useState(false);
  const activeStudioTab = useNodeAgentStore((state) => state.activeStudioTab);
  const nodeAgentRuntimeFilter = useNodeAgentStore((state) => state.nodeAgentRuntimeFilter);
  const nodeAgentSearchQuery = useNodeAgentStore((state) => state.nodeAgentSearchQuery);
  const selectedNodeAgentKey = useNodeAgentStore((state) => state.selectedNodeAgentKey);
  const setActiveStudioTab = useNodeAgentStore((state) => state.setActiveStudioTab);
  const setNodeAgentRuntimeFilter = useNodeAgentStore((state) => state.setNodeAgentRuntimeFilter);
  const setNodeAgentSearchQuery = useNodeAgentStore((state) => state.setNodeAgentSearchQuery);
  const setSelectedNodeAgentKey = useNodeAgentStore((state) => state.setSelectedNodeAgentKey);
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
  const normalizedQuery = nodeAgentSearchQuery.trim().toLowerCase();
  const filteredNodeAgentBindings = nodeAgentBindings.filter(({ application, node, template }) => {
    const matchesRuntime = nodeAgentRuntimeFilter === "all" || (nodeAgentRuntimeFilter === "ai" && node.executor?.type === "aiApplication") || (nodeAgentRuntimeFilter === "system" && node.executor?.type !== "aiApplication");
    const searchTarget = [application?.name, application?.entrypoint, node.description, node.id, node.title, template.name, meetingNodeKindLabels[node.kind]].filter(Boolean).join(" ").toLowerCase();
    return matchesRuntime && (!normalizedQuery || searchTarget.includes(normalizedQuery));
  });

  const selectedBinding = filteredNodeAgentBindings.find(({ node, template }) => `${template.id}-${node.id}` === selectedNodeAgentKey) ?? filteredNodeAgentBindings[0] ?? nodeAgentBindings[0] ?? null;

  useEffect(() => {
    if (!pendingNodeAgentKey) {
      return;
    }

    setSelectedNodeAgentKey(pendingNodeAgentKey);
    setActiveStudioTab("debug");
    clearPendingNodeAgent();
  }, [clearPendingNodeAgent, pendingNodeAgentKey, setActiveStudioTab, setSelectedNodeAgentKey]);
  const selectedApp = selectedBinding?.application ?? null;
  const selectedNode = selectedBinding?.node ?? null;
  const selectedTemplate = selectedBinding?.template ?? null;
  const selectedExecutor = selectedNode?.executor ?? null;

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

  const playgroundNodeRun = debugSession?.run.nodeRuns.find((nodeRun) => nodeRun.nodeId === selectedNode?.id);
  const promptVariableGroups = groupMappingVariableOptions([
    ...meetingMappingVariableOptions,
    ...getEditableInputSchema(selectedApp?.id ?? "").map((field) => ({
      group: "Input Schema",
      label: field.label || field.key,
      value: `input.${field.key}`
    })),
    ...getEditableOutputSchema(selectedApp?.id ?? "").map((field) => ({
      group: "Output Schema",
      label: field.label || field.key,
      value: selectedNode ? `node.${selectedNode.id}.${field.key}` : `node.${field.key}`
    })),
    ...(selectedNode
      ? [
          { group: "当前节点", label: "节点 ID", value: "node.id" },
          { group: "当前节点", label: "节点名称", value: "node.title" },
          { group: "当前节点", label: "节点类型", value: "node.kind" }
        ]
      : [])
  ]);

  function getMappingSourceOptions(mappingType: "inputMapping" | "outputMapping") {
    const appId = selectedApp?.id ?? "";
    const schemaOptions =
      mappingType === "inputMapping"
        ? getEditableInputSchema(appId).map((field) => ({ group: "Input Schema", label: field.label || field.key, value: field.key }))
        : getEditableOutputSchema(appId).map((field) => ({ group: "Output Schema", label: field.label || field.key, value: field.key }));
    return schemaOptions;
  }

  function getMappingTargetOptions() {
    return promptVariableGroups.flatMap((group) => group.options);
  }

  async function runPromptPlayground() {
    if (!selectedApp || !selectedMeeting) {
      return;
    }

    setIsPromptRunning(true);
    try {
      const result = await onDebugApplication(
        selectedApp.id,
        Object.fromEntries(getEditableInputSchema(selectedApp.id).map((field) => [field.key, getAppInputValue(selectedApp.id, field)]))
      );
      if (result) {
        setDebugSession({ applicationId: selectedApp.id, inputs: result.inputs, run: result.run });
        void onReloadMemories();
      }
    } finally {
      setIsPromptRunning(false);
    }
  }

  async function runWorkflowDebug() {
    if (!selectedTemplate || !selectedMeeting || !selectedApp) {
      return;
    }

    const run = await onStartWorkflowRun(selectedMeeting.id, selectedTemplate.id);
    if (run) {
      setDebugSession({
        applicationId: selectedApp.id,
        inputs: { meetingId: selectedMeeting.id, templateId: selectedTemplate.id },
        run
      });
      void onReloadMemories();
    }
  }

  function appendPromptVariable(target: "systemPrompt" | "userPrompt", variable: string) {
    if (!selectedApp) {
      return;
    }

    const config = getEditablePromptConfig(selectedApp.id);
    if (!config) {
      return;
    }

    setPromptConfigField(
      selectedApp.id,
      target,
      `${config[target]}${config[target].trim() ? "\n" : ""}{{${variable}}}`
    );
  }

  return (
    <PageShell className="app-hub" aria-label="节点智能体管理">
      <NodeAgentStudioLayout
        listPanel={(
          <NodeAgentListPanel
            activeStudioTab={activeStudioTab}
            filteredBindings={filteredNodeAgentBindings}
            nodeAgentRuntimeFilter={nodeAgentRuntimeFilter}
            nodeAgentSearchQuery={nodeAgentSearchQuery}
            onConfigureModel={onNavigateToAccount}
            onSelectBinding={setSelectedNodeAgentKey}
            onSetActiveStudioTab={setActiveStudioTab}
            onSetRuntimeFilter={setNodeAgentRuntimeFilter}
            onSetSearchQuery={setNodeAgentSearchQuery}
            selectedNodeAgentKey={selectedNodeAgentKey}
          />
        )}
      >
          <section className="node-agent-detail" aria-label="节点智能体详情">
            {selectedBinding && selectedNode && selectedTemplate ? (
              <>
                <div className="node-agent-detail__header">
                  <div>
                    <span>{selectedTemplate.name}</span><h3>{selectedNode.title}</h3>
                  </div>
                  <span className={`app-status app-status--${selectedApp?.status ?? selectedTemplate.status}`}>
                    {selectedExecutor?.type === "aiApplication" ? "AI 执行" : selectedExecutor?.type === "system" ? "系统执行" : "人工处理"}
                  </span>
                </div>

                {activeStudioTab === "configure" && selectedExecutor && (
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
                          {rows.map((row, i) => {
                            const sourceOptions = withDropdownOption(getMappingSourceOptions(mappingType), row.source).map((option) => ({
                              label: `${option.group} / ${option.label}`,
                              value: option.value
                            }));
                            const targetOptions = withDropdownOption(getMappingTargetOptions(), row.target).map((option) => ({
                              label: `${option.group} / ${option.label}`,
                              value: option.value
                            }));

                            return (
                            <div className="node-agent-map-row" key={`${mappingType}-${i}`}>
                              <Dropdown
                                ariaLabel="source"
                                onChange={(value) => setMappingRows(mappingKey, mappingType, rows.map((r, j) => j === i ? { ...r, source: value } : r))}
                                options={sourceOptions.length > 0 ? sourceOptions : [{ label: row.source || "source", value: row.source || "" }]}
                                value={row.source || sourceOptions[0]?.value || ""}
                              />
                              <Dropdown
                                ariaLabel="target"
                                onChange={(value) => setMappingRows(mappingKey, mappingType, rows.map((r, j) => j === i ? { ...r, target: value } : r))}
                                options={targetOptions.length > 0 ? targetOptions : [{ label: row.target || "target", value: row.target || "" }]}
                                value={row.target || targetOptions[0]?.value || ""}
                              />
                              <button className="ghost-button" onClick={() => setMappingRows(mappingKey, mappingType, rows.filter((_, j) => j !== i))} type="button">删除</button>
                            </div>
                          )})}
                          {rows.length === 0 && <div className="node-agent-inline-empty">暂无映射</div>}
                        </section>
                      );
                    })}
                    <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeMappings()} type="button">保存映射</button>
                  </div>
                )}

                {selectedApp && activeStudioTab === "configure" && (
                  <>
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
                            <label className="node-agent-schema-field">
                              <span>Key</span>
                              <input aria-label="key" onChange={(e) => updateField({ key: e.target.value })} placeholder="meetingRequirement" value={field.key} />
                            </label>
                            <label className="node-agent-schema-field">
                              <span>显示名</span>
                              <input aria-label="label" onChange={(e) => updateField({ label: e.target.value })} placeholder="会议需求" value={field.label} />
                            </label>
                            <label className="node-agent-schema-field">
                              <span>类型</span>
                              <Dropdown ariaLabel="type" onChange={(v) => updateField({ type: v })} options={aiApplicationInputTypes.map((t) => ({ label: t, value: t }))} value={field.type} />
                            </label>
                            <label className="node-agent-schema-field node-agent-schema-field--checkbox node-agent-toggle-row">
                              <span>必填</span>
                              <input checked={field.required} onChange={(e) => updateField({ required: e.target.checked })} type="checkbox" />
                            </label>
                            <label className="node-agent-schema-field node-agent-schema-field--wide">
                              <span>默认值</span>
                              <input aria-label="default value" onChange={(e) => updateField({ defaultValue: e.target.value })} placeholder="可选默认值" value={field.defaultValue} />
                            </label>
                            <label className="node-agent-schema-field node-agent-schema-field--wide">
                              <span>说明</span>
                              <input aria-label="description" onChange={(e) => updateField({ description: e.target.value })} placeholder="字段用途说明" value={field.description} />
                            </label>
                            <div className="node-agent-schema-row__actions">
                              <button className="ghost-button" onClick={() => setSchemaFields(selectedApp.id, "inputSchema", fields.filter((_, j) => j !== i))} type="button">删除</button>
                            </div>
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
                            <label className="node-agent-schema-field">
                              <span>Key</span>
                              <input aria-label="key" onChange={(e) => updateField({ key: e.target.value })} placeholder="result" value={field.key} />
                            </label>
                            <label className="node-agent-schema-field">
                              <span>显示名</span>
                              <input aria-label="label" onChange={(e) => updateField({ label: e.target.value })} placeholder="结果" value={field.label} />
                            </label>
                            <label className="node-agent-schema-field">
                              <span>类型</span>
                              <Dropdown ariaLabel="type" onChange={(v) => updateField({ type: v })} options={aiApplicationOutputTypes.map((t) => ({ label: t, value: t }))} value={field.type} />
                            </label>
                            <label className="node-agent-schema-field node-agent-schema-field--wide">
                              <span>说明</span>
                              <input aria-label="description" onChange={(e) => updateField({ description: e.target.value })} placeholder="输出字段说明" value={field.description} />
                            </label>
                            <div className="node-agent-schema-row__actions">
                              <button className="ghost-button" onClick={() => setSchemaFields(selectedApp.id, "outputSchema", fields.filter((_, j) => j !== i))} type="button">删除</button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="node-agent-schema-editor__footer">
                        <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeSchema()} type="button">保存 Schema</button>
                      </div>
                    </div>
                  </>
                )}

                {selectedApp && selectedNode && activeStudioTab === "debug" && (() => {
                  const config = getEditablePromptConfig(selectedApp.id);
                  if (!config) {
                    return null;
                  }

                  return (
                    <NodeAgentDebugStudio
                      app={selectedApp}
                      appId={selectedApp.id}
                      debugSession={debugSession}
                      getAppInputValue={(field) => getAppInputValue(selectedApp.id, field)}
                      inputSchema={getEditableInputSchema(selectedApp.id)}
                      isRunning={isPromptRunning}
                      isWorkflowMutating={isWorkflowMutating}
                      lastNodeRun={playgroundNodeRun}
                      meeting={selectedMeeting}
                      node={selectedNode}
                      onAppendVariable={appendPromptVariable}
                      onDebugWorkflow={() => void runWorkflowDebug()}
                      onInputChange={(fieldKey, value) =>
                        setAppInputDrafts((current) => ({
                          ...current,
                          [selectedApp.id]: { ...current[selectedApp.id], [fieldKey]: value }
                        }))
                      }
                      onPromptChange={(key, value) => setPromptConfigField(selectedApp.id, key, value)}
                      onRunPrompt={() => void runPromptPlayground()}
                      onSavePrompt={() => void saveSelectedNodePromptConfig()}
                      onTogglePublish={() => void onUpdateApplicationStatus(selectedApp.id, selectedApp.status === "published" ? "draft" : "published")}
                      promptConfig={config}
                      template={selectedTemplate}
                      variableGroups={promptVariableGroups}
                    />
                  );
                })()}

                {selectedApp && activeStudioTab === "versions" && (
                  <div className="node-agent-version-panel" aria-label="节点智能体版本记录">
                      <div className="node-agent-editor__section-title">
                        <span>版本记录</span>
                        <div className="node-agent-editor__section-actions">
                          <button className="ghost-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeVersion("snapshot")} type="button">保存快照</button>
                          <button className="primary-button" disabled={isWorkflowMutating} onClick={() => void saveSelectedNodeVersion("published")} type="button">发布版本</button>
                        </div>
                      </div>
                      <div className="node-agent-version-list">
                        <SelectableCardList
                          ariaLabel="节点智能体版本"
                          empty={<div className="node-agent-inline-empty">暂无版本记录，可先保存快照或发布一个版本。</div>}
                          items={selectedApp.versions.slice(0, 5).map((version) => ({
                            id: version.id,
                            title: version.version,
                            badge: version.status === "published" ? "已发布" : "快照",
                            badgeClassName: `app-status app-status--${version.status === "published" ? "published" : "draft"}`,
                            description: version.summary,
                            meta: `${version.promptConfig.model} / ${version.createdBy} / ${formatDateTime(version.createdAt)}`,
                            actions: (
                              <button
                                className="ghost-button"
                                disabled={isWorkflowMutating}
                                onClick={() => void onApplyApplicationVersion(selectedApp.id, version.id)}
                                type="button"
                              >
                                设为当前
                              </button>
                            )
                          }))}
                          layout="stack"
                        />
                      </div>

                      <NodeAgentVersionDiffPanel
                        currentVersionLabel={selectedApp.versions[0]?.version ?? "当前草稿"}
                        isWorkflowMutating={isWorkflowMutating}
                        onApplyVersion={(versionId) => void onApplyApplicationVersion(selectedApp.id, versionId)}
                        versions={selectedApp.versions}
                      />
                    </div>
                )}
              </>
            ) : (
              <div className="node-agent-empty">请选择一个流程节点</div>
            )}
          </section>
      </NodeAgentStudioLayout>
    </PageShell>
  );
}

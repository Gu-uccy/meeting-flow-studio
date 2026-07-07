import type { AiApplicationVersion } from "@meeting-flow/shared";

export type VersionDiffRow = {
  after: string;
  before: string;
  changed: boolean;
  label: string;
};

function formatSchemaSummary(version: AiApplicationVersion, type: "inputSchema" | "outputSchema") {
  const fields = version[type];
  return fields.length === 0 ? "无字段" : fields.map((field) => field.key).join(", ");
}

export function buildVersionDiffRows(base: AiApplicationVersion, target: AiApplicationVersion): VersionDiffRow[] {
  const rows: VersionDiffRow[] = [
    {
      label: "System Prompt",
      before: base.promptConfig.systemPrompt,
      after: target.promptConfig.systemPrompt,
      changed: base.promptConfig.systemPrompt !== target.promptConfig.systemPrompt
    },
    {
      label: "User Prompt",
      before: base.promptConfig.userPrompt,
      after: target.promptConfig.userPrompt,
      changed: base.promptConfig.userPrompt !== target.promptConfig.userPrompt
    },
    {
      label: "模型",
      before: base.promptConfig.model,
      after: target.promptConfig.model,
      changed: base.promptConfig.model !== target.promptConfig.model
    },
    {
      label: "Temperature",
      before: String(base.promptConfig.temperature),
      after: String(target.promptConfig.temperature),
      changed: base.promptConfig.temperature !== target.promptConfig.temperature
    },
    {
      label: "Max Tokens",
      before: String(base.promptConfig.maxTokens),
      after: String(target.promptConfig.maxTokens),
      changed: base.promptConfig.maxTokens !== target.promptConfig.maxTokens
    },
    {
      label: "Input Schema",
      before: formatSchemaSummary(base, "inputSchema"),
      after: formatSchemaSummary(target, "inputSchema"),
      changed: formatSchemaSummary(base, "inputSchema") !== formatSchemaSummary(target, "inputSchema")
    },
    {
      label: "Output Schema",
      before: formatSchemaSummary(base, "outputSchema"),
      after: formatSchemaSummary(target, "outputSchema"),
      changed: formatSchemaSummary(base, "outputSchema") !== formatSchemaSummary(target, "outputSchema")
    }
  ];

  return rows;
}

export function countVersionChanges(rows: VersionDiffRow[]) {
  return rows.filter((row) => row.changed).length;
}

import type { AiApplicationOutputField } from "@meeting-flow/shared";

export function buildStructuredOutputSchemaPrompt(schema: AiApplicationOutputField[]) {
  if (schema.length === 0) {
    return "";
  }

  const fieldLines = schema.map((field) => {
    const description = field.description?.trim() ? ` — ${field.description.trim()}` : "";
    return `- ${field.key} (${field.type}): ${field.label}${description}`;
  });

  const example = JSON.stringify(
    Object.fromEntries(
      schema.map((field) => {
        if (field.type === "number") return [field.key, 0];
        if (field.type === "boolean") return [field.key, true];
        if (field.type === "json") return [field.key, {}];
        return [field.key, `${field.label} 示例`];
      })
    ),
    null,
    2
  );

  return [
    "【输出格式要求】",
    "你必须只返回一个 JSON 对象，不要输出 markdown 代码块、解释文字或额外字段。",
    "JSON 必须包含且仅包含以下字段：",
    ...fieldLines,
    "",
    "示例：",
    example
  ].join("\n");
}

export function extractJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
}

export function coerceOutputValue(field: AiApplicationOutputField, value: unknown): { value: unknown; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { value, error: `${field.label || field.key} 缺少输出` };
  }

  if (field.type === "text") {
    return { value: typeof value === "string" ? value : JSON.stringify(value) };
  }

  if (field.type === "number") {
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue)
      ? { value: numericValue }
      : { value, error: `${field.label || field.key} 必须是数字` };
  }

  if (field.type === "boolean") {
    if (typeof value === "boolean") {
      return { value };
    }

    if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) {
      return { value: value.toLowerCase() === "true" };
    }

    return { value, error: `${field.label || field.key} 必须是布尔值` };
  }

  if (field.type === "json" && typeof value === "string") {
    try {
      return { value: JSON.parse(value) };
    } catch {
      return { value, error: `${field.label || field.key} 必须是 JSON` };
    }
  }

  return { value };
}

export function validateStructuredOutput(schema: AiApplicationOutputField[], rawOutput: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of schema) {
    const coerced = coerceOutputValue(field, rawOutput[field.key]);
    if (coerced.error) {
      errors.push(coerced.error);
    } else {
      output[field.key] = coerced.value;
    }
  }

  return { output, errors };
}

type ModelRuntimeBadgeProps = {
  label: string;
  compact?: boolean;
};

export function ModelRuntimeBadge({ label, compact = false }: ModelRuntimeBadgeProps) {
  const tone = label.includes("未配置") ? "unavailable" : "ready";

  return (
    <span
      className={`model-runtime-badge model-runtime-badge--${tone}${compact ? " model-runtime-badge--compact" : ""}`}
      data-testid="model-runtime-badge"
      title={label.includes("未配置") ? "请在账号设置中配置 OpenAI 兼容 AI API Key" : label}
    >
      {compact ? label.replace("模型 ", "") : label}
    </span>
  );
}

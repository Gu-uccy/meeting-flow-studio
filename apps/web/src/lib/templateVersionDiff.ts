import type { ProductWorkflowTemplateVersion } from "@meeting-flow/shared";

export type TemplateVersionDiffRow = {
  after: string;
  before: string;
  changed: boolean;
  label: string;
};

function summarizeNodes(version: ProductWorkflowTemplateVersion) {
  return version.nodes.map((node) => `${node.title}(${node.kind})`).join(" · ") || "无节点";
}

function summarizeConfig(version: ProductWorkflowTemplateVersion) {
  const fields = version.nodes.flatMap((node) =>
    node.configFields.map((field) => `${node.title}.${field.key}=${field.value}`)
  );
  return fields.length > 0 ? fields.join(" · ") : "无配置项";
}

export function buildTemplateVersionDiffRows(
  base: ProductWorkflowTemplateVersion,
  target: ProductWorkflowTemplateVersion
): TemplateVersionDiffRow[] {
  return [
    {
      label: "模板名称",
      before: base.name,
      after: target.name,
      changed: base.name !== target.name
    },
    {
      label: "描述",
      before: base.description,
      after: target.description,
      changed: base.description !== target.description
    },
    {
      label: "类别",
      before: base.category,
      after: target.category,
      changed: base.category !== target.category
    },
    {
      label: "节点数",
      before: String(base.nodes.length),
      after: String(target.nodes.length),
      changed: base.nodes.length !== target.nodes.length
    },
    {
      label: "连线数",
      before: String(base.edges.length),
      after: String(target.edges.length),
      changed: base.edges.length !== target.edges.length
    },
    {
      label: "节点列表",
      before: summarizeNodes(base),
      after: summarizeNodes(target),
      changed: summarizeNodes(base) !== summarizeNodes(target)
    },
    {
      label: "节点配置",
      before: summarizeConfig(base),
      after: summarizeConfig(target),
      changed: summarizeConfig(base) !== summarizeConfig(target)
    }
  ];
}

export function countTemplateVersionChanges(rows: TemplateVersionDiffRow[]) {
  return rows.filter((row) => row.changed).length;
}

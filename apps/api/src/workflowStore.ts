import {
  productWorkflowRuns,
  productWorkflowTemplates,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { createJsonDocumentRepository, createWorkflowRunRepository } from "./repositories/jsonDocumentRepository.js";

function sortByStartedAtDesc(left: ProductWorkflowRun, right: ProductWorkflowRun) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

function sortTemplatesByUpdatedAtDesc(left: ProductWorkflowTemplate, right: ProductWorkflowTemplate) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

const garbledChinesePattern = /鑺傜偣|娴佺▼|浼氳|鍚屾|缁撴|闃诲|椋炰功|鏃ュ巻|杩愯|閰嶇疆|鐢诲竷|寰呭姙|璁板綍/;

function shouldRepairText(value: string) {
  return garbledChinesePattern.test(value);
}

function repairText(value: string, fallback?: string) {
  return fallback && shouldRepairText(value) ? fallback : value;
}

function repairTextArray(values: string[], fallback?: string[]) {
  if (!fallback || !values.some(shouldRepairText)) {
    return values;
  }

  return fallback;
}

function repairTemplateText(template: ProductWorkflowTemplate) {
  const seedTemplate = productWorkflowTemplates.find((item) => item.id === template.id);
  if (!seedTemplate) {
    return template;
  }

  return {
    ...template,
    name: repairText(template.name, seedTemplate.name),
    description: repairText(template.description, seedTemplate.description),
    nodes: template.nodes.map((node) => {
      const seedNode = seedTemplate.nodes.find((item) => item.id === node.id);
      if (!seedNode) {
        return node;
      }

      return {
        ...node,
        title: repairText(node.title, seedNode.title),
        description: repairText(node.description, seedNode.description),
        owner: repairText(node.owner, seedNode.owner),
        inputs: repairTextArray(node.inputs, seedNode.inputs),
        outputs: repairTextArray(node.outputs, seedNode.outputs),
        configFields: node.configFields.map((field) => {
          const seedField = seedNode.configFields.find((item) => item.key === field.key);
          if (!seedField) {
            return field;
          }

          return {
            ...field,
            label: repairText(field.label, seedField.label),
            value: repairText(field.value, seedField.value)
          };
        })
      };
    }),
    edges: template.edges.map((edge) => {
      const seedEdge = seedTemplate.edges.find((item) => item.id === edge.id);
      if (!seedEdge) {
        return edge;
      }

      return {
        ...edge,
        label: repairText(edge.label, seedEdge.label),
        condition: edge.condition ? repairText(edge.condition, seedEdge.condition) : edge.condition,
        dataMapping:
          edge.dataMapping && Object.values(edge.dataMapping).some(shouldRepairText)
            ? seedEdge.dataMapping ?? edge.dataMapping
            : edge.dataMapping
      };
    })
  };
}

export async function loadWorkflowRuns() {
  return withDatabase(async (db) => {
    const repository = createWorkflowRunRepository<ProductWorkflowRun>({
      db,
      parse: (payload) => JSON.parse(payload) as ProductWorkflowRun,
      serialize: (run) => JSON.stringify(run),
      getStartedAt: (run) => run.startedAt,
      getUpdatedAt: (run) => run.endedAt ?? run.startedAt
    });

    const storedRuns = (await repository.loadAll()).sort(sortByStartedAtDesc);
    if (storedRuns.length > 0) {
      return storedRuns;
    }

    await repository.replaceAll(productWorkflowRuns);
    return [...productWorkflowRuns].sort(sortByStartedAtDesc);
  });
}

export async function saveWorkflowRuns(runs: ProductWorkflowRun[]) {
  await withDatabase(async (db) => {
    const repository = createWorkflowRunRepository<ProductWorkflowRun>({
      db,
      parse: (payload) => JSON.parse(payload) as ProductWorkflowRun,
      serialize: (run) => JSON.stringify(run),
      getStartedAt: (run) => run.startedAt,
      getUpdatedAt: (run) => run.endedAt ?? run.startedAt
    });

    await repository.replaceAll(runs);
  });
}

export async function loadWorkflowTemplates() {
  return withDatabase(async (db) => {
    const repository = createJsonDocumentRepository<ProductWorkflowTemplate>({
      db,
      table: "workflow_templates",
      parse: (payload) => JSON.parse(payload) as ProductWorkflowTemplate,
      serialize: (template) => JSON.stringify(template),
      getUpdatedAt: (template) => template.updatedAt
    });

    const storedTemplates = (await repository.loadAll())
      .map(repairTemplateText)
      .sort(sortTemplatesByUpdatedAtDesc);

    if (storedTemplates.length > 0) {
      const rawTemplates = (await repository.loadAll()).sort(sortTemplatesByUpdatedAtDesc);
      if (JSON.stringify(storedTemplates) !== JSON.stringify(rawTemplates)) {
        await repository.replaceAll(storedTemplates);
      }

      return storedTemplates;
    }

    await repository.replaceAll(productWorkflowTemplates);
    return [...productWorkflowTemplates].sort(sortTemplatesByUpdatedAtDesc);
  });
}

export async function saveWorkflowTemplates(templates: ProductWorkflowTemplate[]) {
  await withDatabase(async (db) => {
    const repository = createJsonDocumentRepository<ProductWorkflowTemplate>({
      db,
      table: "workflow_templates",
      parse: (payload) => JSON.parse(payload) as ProductWorkflowTemplate,
      serialize: (template) => JSON.stringify(template),
      getUpdatedAt: (template) => template.updatedAt
    });

    await repository.replaceAll(templates);
  });
}

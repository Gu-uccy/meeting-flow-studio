import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  productWorkflowRuns,
  productWorkflowTemplates,
  type ProductWorkflowRun,
  type ProductWorkflowTemplate
} from "@meeting-flow/shared";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const databaseFile = path.join(dataDir, "meetings.db");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function sortByStartedAtDesc(left: ProductWorkflowRun, right: ProductWorkflowRun) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

function openDatabase() {
  ensureDataDir();
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return database;
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

function loadWorkflowRunsFromDatabase(database: DatabaseSync) {
  const rows = database
    .prepare("SELECT payload FROM workflow_runs ORDER BY datetime(started_at) DESC")
    .all() as Array<{ payload: string }>;

  return rows.map((row) => JSON.parse(row.payload) as ProductWorkflowRun).sort(sortByStartedAtDesc);
}

function replaceWorkflowRuns(database: DatabaseSync, runs: ProductWorkflowRun[]) {
  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT INTO workflow_runs (id, payload, started_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      started_at = excluded.started_at,
      updated_at = excluded.updated_at
  `);

  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM workflow_runs");

    for (const run of runs) {
      insert.run(run.id, JSON.stringify(run), run.startedAt, run.endedAt ?? now);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function loadWorkflowTemplatesFromDatabase(database: DatabaseSync) {
  const rows = database
    .prepare("SELECT payload FROM workflow_templates ORDER BY datetime(updated_at) DESC")
    .all() as Array<{ payload: string }>;

  return rows
    .map((row) => repairTemplateText(JSON.parse(row.payload) as ProductWorkflowTemplate))
    .sort(sortTemplatesByUpdatedAtDesc);
}

function replaceWorkflowTemplates(database: DatabaseSync, templates: ProductWorkflowTemplate[]) {
  const insert = database.prepare(`
    INSERT INTO workflow_templates (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);

  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM workflow_templates");

    for (const template of templates) {
      insert.run(template.id, JSON.stringify(template), template.updatedAt);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function loadWorkflowRuns() {
  const database = openDatabase();

  try {
    const storedRuns = loadWorkflowRunsFromDatabase(database);
    if (storedRuns.length > 0) {
      return storedRuns;
    }

    replaceWorkflowRuns(database, productWorkflowRuns);
    return [...productWorkflowRuns].sort(sortByStartedAtDesc);
  } finally {
    database.close();
  }
}

export async function saveWorkflowRuns(runs: ProductWorkflowRun[]) {
  const database = openDatabase();

  try {
    replaceWorkflowRuns(database, runs);
  } finally {
    database.close();
  }
}

export async function loadWorkflowTemplates() {
  const database = openDatabase();

  try {
    const storedTemplates = loadWorkflowTemplatesFromDatabase(database);
    if (storedTemplates.length > 0) {
      const rawTemplates = database
        .prepare("SELECT payload FROM workflow_templates ORDER BY datetime(updated_at) DESC")
        .all()
        .map((row) => JSON.parse((row as { payload: string }).payload) as ProductWorkflowTemplate);
      if (JSON.stringify(storedTemplates) !== JSON.stringify(rawTemplates.sort(sortTemplatesByUpdatedAtDesc))) {
        replaceWorkflowTemplates(database, storedTemplates);
      }

      return storedTemplates;
    }

    replaceWorkflowTemplates(database, productWorkflowTemplates);
    return [...productWorkflowTemplates].sort(sortTemplatesByUpdatedAtDesc);
  } finally {
    database.close();
  }
}

export async function saveWorkflowTemplates(templates: ProductWorkflowTemplate[]) {
  const database = openDatabase();

  try {
    replaceWorkflowTemplates(database, templates);
  } finally {
    database.close();
  }
}

import cron from "node-cron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { MeetingRecord, ProductWorkflowTemplate } from "@meeting-flow/shared";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../data");
const databaseFile = path.join(dataDir, "meetings.db");

export type WorkflowSchedule = {
  id: string;
  templateId: string;
  cronExpression: string;
  enabled: boolean;
  lastTriggeredAt?: string;
};

let schedules: WorkflowSchedule[] = [];
let onScheduleTrigger: ((templateId: string) => Promise<void>) | null = null;

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function openDatabase() {
  ensureDataDir();
  const db = new DatabaseSync(databaseFile);
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_schedules (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_triggered_at TEXT
    )
  `);
  return db;
}

export function loadSchedules(existingSchedules?: WorkflowSchedule[]) {
  if (existingSchedules) {
    schedules = existingSchedules;
    return;
  }

  const db = openDatabase();
  try {
    const rows = db.prepare("SELECT * FROM workflow_schedules").all() as Array<{
      id: string;
      template_id: string;
      cron_expression: string;
      enabled: number;
      last_triggered_at: string | null;
    }>;

    schedules = rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      cronExpression: row.cron_expression,
      enabled: row.enabled === 1,
      lastTriggeredAt: row.last_triggered_at ?? undefined
    }));
  } finally {
    db.close();
  }
}

export function saveSchedules() {
  const db = openDatabase();
  try {
    const insert = db.prepare(`
      INSERT INTO workflow_schedules (id, template_id, cron_expression, enabled, last_triggered_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        template_id = excluded.template_id,
        cron_expression = excluded.cron_expression,
        enabled = excluded.enabled,
        last_triggered_at = excluded.last_triggered_at
    `);

    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM workflow_schedules");
      for (const s of schedules) {
        insert.run(s.id, s.templateId, s.cronExpression, s.enabled ? 1 : 0, s.lastTriggeredAt ?? null);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  } finally {
    db.close();
  }
}

export function getAllSchedules() {
  return schedules;
}

export function addSchedule(schedule: WorkflowSchedule) {
  schedules.push(schedule);
  saveSchedules();
  registerCronJob(schedule);
  return schedule;
}

export function removeSchedule(id: string) {
  schedules = schedules.filter((s) => s.id !== id);
  saveSchedules();
}

let cronJobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();

function registerCronJob(schedule: WorkflowSchedule) {
  if (!schedule.enabled || !cron.validate(schedule.cronExpression)) {
    return;
  }

  const existing = cronJobs.get(schedule.id);
  if (existing) {
    existing.stop();
  }

  const job = cron.schedule(schedule.cronExpression, async () => {
    if (!onScheduleTrigger) return;

    schedule.lastTriggeredAt = new Date().toISOString();
    saveSchedules();

    try {
      await onScheduleTrigger(schedule.templateId);
    } catch (err) {
      console.error(`Schedule ${schedule.id} trigger failed:`, err);
    }
  });

  cronJobs.set(schedule.id, job);
}

export function startScheduler(
  _currentTemplates: ProductWorkflowTemplate[],
  _currentMeetings: MeetingRecord[],
  triggerCallback: (templateId: string) => Promise<void>
) {
  onScheduleTrigger = triggerCallback;

  loadSchedules();

  // Register all active schedules
  for (const schedule of schedules) {
    if (schedule.enabled) {
      registerCronJob(schedule);
    }
  }
}

export function stopScheduler() {
  for (const job of cronJobs.values()) {
    job.stop();
  }
  cronJobs.clear();
}


import cron from "node-cron";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { MeetingRecord, ProductWorkflowRunStatus, ProductWorkflowTemplate } from "@meeting-flow/shared";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const databaseFile = path.join(dataDir, "meetings.db");

export type WorkflowScheduleExecution = {
  runId: string;
  triggeredAt: string;
  status: ProductWorkflowRunStatus;
};

export type WorkflowSchedule = {
  id: string;
  templateId: string;
  cronExpression: string;
  enabled: boolean;
  meetingId?: string;
  lastTriggeredAt?: string;
  lastRunId?: string;
  executionHistory?: WorkflowScheduleExecution[];
};

let schedules: WorkflowSchedule[] = [];
let onScheduleTrigger: ((schedule: WorkflowSchedule) => Promise<void>) | null = null;

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
      last_triggered_at TEXT,
      meeting_id TEXT,
      last_run_id TEXT,
      execution_history TEXT
    )
  `);

  const columns = db.prepare("PRAGMA table_info(workflow_schedules)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("meeting_id")) {
    db.exec("ALTER TABLE workflow_schedules ADD COLUMN meeting_id TEXT");
  }
  if (!columnNames.has("last_run_id")) {
    db.exec("ALTER TABLE workflow_schedules ADD COLUMN last_run_id TEXT");
  }
  if (!columnNames.has("execution_history")) {
    db.exec("ALTER TABLE workflow_schedules ADD COLUMN execution_history TEXT");
  }

  return db;
}

function parseExecutionHistory(value: string | null): WorkflowScheduleExecution[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as WorkflowScheduleExecution[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
      meeting_id: string | null;
      last_run_id: string | null;
      execution_history: string | null;
    }>;

    schedules = rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      cronExpression: row.cron_expression,
      enabled: row.enabled === 1,
      lastTriggeredAt: row.last_triggered_at ?? undefined,
      meetingId: row.meeting_id ?? undefined,
      lastRunId: row.last_run_id ?? undefined,
      executionHistory: parseExecutionHistory(row.execution_history)
    }));
  } finally {
    db.close();
  }
}

export function saveSchedules() {
  const db = openDatabase();
  try {
    const insert = db.prepare(`
      INSERT INTO workflow_schedules (
        id, template_id, cron_expression, enabled, last_triggered_at, meeting_id, last_run_id, execution_history
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        template_id = excluded.template_id,
        cron_expression = excluded.cron_expression,
        enabled = excluded.enabled,
        last_triggered_at = excluded.last_triggered_at,
        meeting_id = excluded.meeting_id,
        last_run_id = excluded.last_run_id,
        execution_history = excluded.execution_history
    `);

    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM workflow_schedules");
      for (const schedule of schedules) {
        insert.run(
          schedule.id,
          schedule.templateId,
          schedule.cronExpression,
          schedule.enabled ? 1 : 0,
          schedule.lastTriggeredAt ?? null,
          schedule.meetingId ?? null,
          schedule.lastRunId ?? null,
          JSON.stringify(schedule.executionHistory ?? [])
        );
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
  schedules.push({
    ...schedule,
    executionHistory: schedule.executionHistory ?? []
  });
  saveSchedules();
  registerCronJob(schedule);
  return schedule;
}

export function updateSchedule(id: string, patch: Partial<Pick<WorkflowSchedule, "enabled" | "meetingId" | "cronExpression">>) {
  const index = schedules.findIndex((schedule) => schedule.id === id);
  if (index < 0) {
    return null;
  }

  const current = schedules[index]!;
  const next: WorkflowSchedule = {
    ...current,
    ...patch,
    meetingId: patch.meetingId === undefined ? current.meetingId : patch.meetingId
  };

  schedules[index] = next;
  saveSchedules();

  const existing = cronJobs.get(id);
  if (existing) {
    existing.stop();
    cronJobs.delete(id);
  }

  if (next.enabled) {
    registerCronJob(next);
  }

  return next;
}

export function removeSchedule(id: string) {
  const existing = cronJobs.get(id);
  if (existing) {
    existing.stop();
    cronJobs.delete(id);
  }

  schedules = schedules.filter((schedule) => schedule.id !== id);
  saveSchedules();
}

export function recordScheduleExecution(scheduleId: string, runId: string, status: ProductWorkflowRunStatus) {
  const index = schedules.findIndex((schedule) => schedule.id === scheduleId);
  if (index < 0) {
    return;
  }

  const current = schedules[index]!;
  const entry: WorkflowScheduleExecution = {
    runId,
    triggeredAt: new Date().toISOString(),
    status
  };

  schedules[index] = {
    ...current,
    lastRunId: runId,
    executionHistory: [entry, ...(current.executionHistory ?? [])].slice(0, 20)
  };
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
      await onScheduleTrigger(schedule);
    } catch (err) {
      console.error(`Schedule ${schedule.id} trigger failed:`, err);
    }
  });

  cronJobs.set(schedule.id, job);
}

export function startScheduler(
  _currentTemplates: ProductWorkflowTemplate[],
  _currentMeetings: MeetingRecord[],
  triggerCallback: (schedule: WorkflowSchedule) => Promise<void>
) {
  onScheduleTrigger = triggerCallback;

  loadSchedules();

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

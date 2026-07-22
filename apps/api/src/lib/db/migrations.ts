import type { DbClient } from "./client.js";
import type { DbDriver } from "./config.js";

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_memories (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_memories_meeting_id ON meeting_memories(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_memories_source_run_id ON meeting_memories(source_run_id);
CREATE INDEX IF NOT EXISTS idx_meeting_memories_kind ON meeting_memories(kind);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_model_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT,
  auth_tag TEXT,
  key_hint TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  chat_model TEXT NOT NULL DEFAULT '',
  embedding_model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_accounts (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS app_service_keys (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'text',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_meeting_id ON knowledge_documents(meeting_id);

CREATE TABLE IF NOT EXISTS knowledge_vector_chunks (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_vector_chunks_meeting_id ON knowledge_vector_chunks(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_chat_messages (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_meeting_id ON meeting_chat_messages(meeting_id);

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  meeting_id TEXT,
  last_run_id TEXT,
  execution_history TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
`;

const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_memories (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_memories_meeting_id ON meeting_memories(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_memories_source_run_id ON meeting_memories(source_run_id);
CREATE INDEX IF NOT EXISTS idx_meeting_memories_kind ON meeting_memories(kind);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_model_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT,
  auth_tag TEXT,
  key_hint TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  chat_model TEXT NOT NULL DEFAULT '',
  embedding_model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_accounts (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS app_service_keys (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_meeting_id ON knowledge_documents(meeting_id);

CREATE TABLE IF NOT EXISTS knowledge_vector_chunks (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_vector_chunks_meeting_id ON knowledge_vector_chunks(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_chat_messages (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_chat_messages_meeting_id ON meeting_chat_messages(meeting_id);

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  meeting_id TEXT,
  last_run_id TEXT,
  execution_history TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
`;

export function orderByTimestampColumn(column: string, driver: DbDriver) {
  return driver === "postgres" ? `${column} DESC` : `datetime(${column}) DESC`;
}

function splitSqlStatements(schema: string) {
  return schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function runMigrations(db: DbClient) {
  const schema = db.driver === "postgres" ? POSTGRES_SCHEMA : SQLITE_SCHEMA;

  for (const statement of splitSqlStatements(schema)) {
    await db.exec(statement);
  }

  if (db.driver === "sqlite") {
    const columns = await db.prepare("PRAGMA table_info(workflow_schedules)").all<{ name: string }>();
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("meeting_id")) {
      await db.exec("ALTER TABLE workflow_schedules ADD COLUMN meeting_id TEXT");
    }
    if (!columnNames.has("last_run_id")) {
      await db.exec("ALTER TABLE workflow_schedules ADD COLUMN last_run_id TEXT");
    }
    if (!columnNames.has("execution_history")) {
      await db.exec("ALTER TABLE workflow_schedules ADD COLUMN execution_history TEXT");
    }

    const aiKeyColumns = await db.prepare("PRAGMA table_info(ai_model_keys)").all<{ name: string }>();
    const aiKeyColumnNames = new Set(aiKeyColumns.map((column) => column.name));
    if (!aiKeyColumnNames.has("iv")) {
      await db.exec("ALTER TABLE ai_model_keys ADD COLUMN iv TEXT");
    }
    if (!aiKeyColumnNames.has("auth_tag")) {
      await db.exec("ALTER TABLE ai_model_keys ADD COLUMN auth_tag TEXT");
    }
    if (!aiKeyColumnNames.has("base_url")) {
      await db.exec("ALTER TABLE ai_model_keys ADD COLUMN base_url TEXT NOT NULL DEFAULT ''");
    }
    if (!aiKeyColumnNames.has("chat_model")) {
      await db.exec("ALTER TABLE ai_model_keys ADD COLUMN chat_model TEXT NOT NULL DEFAULT ''");
    }
    if (!aiKeyColumnNames.has("embedding_model")) {
      await db.exec("ALTER TABLE ai_model_keys ADD COLUMN embedding_model TEXT NOT NULL DEFAULT ''");
    }
  }
}

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import {
  meetingRecordSchema,
  userSchema,
  type User
} from "@meeting-flow/shared";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../data");
const databaseFile = path.join(dataDir, "meetings.db");

function ensureDataDir() {
  mkdirSync(dataDir, { recursive: true });
}

function openDatabase() {
  ensureDataDir();
  const database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  return database;
}

async function buildSeedUsers(): Promise<User[]> {
  const hash = await bcrypt.hash("admin123", 10);
  const now = "2026-03-20T00:00:00.000Z";

  return [
    {
      id: "user-admin-001",
      email: "admin@meetingflow.local",
      name: "系统管理员",
      passwordHash: hash,
      role: "admin" as const,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-editor-001",
      email: "editor@meetingflow.local",
      name: "编辑用户",
      passwordHash: hash,
      role: "editor" as const,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-viewer-001",
      email: "viewer@meetingflow.local",
      name: "观察用户",
      passwordHash: hash,
      role: "viewer" as const,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function loadUsersFromDatabase(database: DatabaseSync) {
  const rows = database
    .prepare("SELECT payload FROM users ORDER BY datetime(created_at) DESC")
    .all() as Array<{ payload: string }>;

  return rows
    .map((row) => userSchema.parse(JSON.parse(row.payload)));
}

function replaceUsers(database: DatabaseSync, users: User[]) {
  const insert = database.prepare(`
    INSERT INTO users (id, email, payload, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      payload = excluded.payload,
      created_at = excluded.created_at
  `);

  database.exec("BEGIN");
  try {
    database.exec("DELETE FROM users");

    for (const user of users) {
      insert.run(user.id, user.email, JSON.stringify(user), user.createdAt);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function migrateSeedMeetingsOwnership(database: DatabaseSync) {
  // Assign existing meetings without ownerUserId to the admin user
  const rows = database
    .prepare("SELECT payload FROM meetings")
    .all() as Array<{ payload: string }>;

  const migrateInsert = database.prepare(`
    UPDATE meetings SET payload = ? WHERE id = ?
  `);

  let hasChanges = false;
  database.exec("BEGIN");
  try {
    for (const row of rows) {
      const meeting = meetingRecordSchema.parse(JSON.parse(row.payload));
      if (!meeting.ownerUserId) {
        const updated = { ...meeting, ownerUserId: "user-admin-001" };
        migrateInsert.run(JSON.stringify(updated), meeting.id);
        hasChanges = true;
      }
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return hasChanges;
}

export async function loadUsers() {
  const database = openDatabase();

  try {
    const storedUsers = loadUsersFromDatabase(database);
    if (storedUsers.length > 0) {
      return storedUsers;
    }

    const seedUsers = await buildSeedUsers();
    replaceUsers(database, seedUsers);
    return [...seedUsers];
  } finally {
    database.close();
  }
}

export async function saveUsers(users: User[]) {
  const database = openDatabase();

  try {
    replaceUsers(database, users);
  } finally {
    database.close();
  }
}

export async function findUserByEmail(email: string) {
  const database = openDatabase();

  try {
    const row = database
      .prepare("SELECT payload FROM users WHERE email = ?")
      .get(email) as { payload: string } | undefined;

    if (!row) {
      return undefined;
    }

    return userSchema.parse(JSON.parse(row.payload));
  } finally {
    database.close();
  }
}

export async function findUserById(id: string) {
  const database = openDatabase();

  try {
    const row = database
      .prepare("SELECT payload FROM users WHERE id = ?")
      .get(id) as { payload: string } | undefined;

    if (!row) {
      return undefined;
    }

    return userSchema.parse(JSON.parse(row.payload));
  } finally {
    database.close();
  }
}

export async function createUser(email: string, name: string, passwordHash: string, role: User["role"] = "editor") {
  const database = openDatabase();

  try {
    const now = new Date().toISOString();
    const user: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: email.toLowerCase(),
      name,
      passwordHash,
      role,
      createdAt: now,
      updatedAt: now
    };

    const insert = database.prepare(`
      INSERT INTO users (id, email, payload, created_at)
      VALUES (?, ?, ?, ?)
    `);

    database.exec("BEGIN");
    try {
      insert.run(user.id, user.email, JSON.stringify(user), user.createdAt);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return user;
  } finally {
    database.close();
  }
}

export async function migrateExistingMeetings() {
  const database = openDatabase();

  try {
    const hasChanges = migrateSeedMeetingsOwnership(database);
    if (hasChanges) {
      // Also patch in-memory meeting store data
    }
  } finally {
    database.close();
  }
}

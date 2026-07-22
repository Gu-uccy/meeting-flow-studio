import bcrypt from "bcryptjs";
import {
  DEFAULT_WORKSPACE_ID,
  TEAM_B_WORKSPACE_ID,
  meetingRecordSchema,
  userSchema,
  type User,
} from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";

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
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceIds: [],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-editor-001",
      email: "editor@meetingflow.local",
      name: "编辑用户",
      passwordHash: hash,
      role: "editor" as const,
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceIds: [DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "user-viewer-001",
      email: "viewer@meetingflow.local",
      name: "观察用户",
      passwordHash: hash,
      role: "viewer" as const,
      workspaceId: DEFAULT_WORKSPACE_ID,
      workspaceIds: [],
      createdAt: now,
      updatedAt: now
    }
  ];
}

async function replaceUsers(db: Parameters<Parameters<typeof withDatabase>[0]>[0], users: User[]) {
  await db.transaction(async (tx) => {
    await tx.exec("DELETE FROM users");

    const insert = tx.prepare(`
      INSERT INTO users (id, email, payload, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        payload = excluded.payload,
        created_at = excluded.created_at
    `);

    for (const user of users) {
      await insert.run(user.id, user.email, JSON.stringify(user), user.createdAt);
    }
  });
}

async function loadUsersFromDatabase(db: Parameters<Parameters<typeof withDatabase>[0]>[0]) {
  const orderBy = orderByTimestampColumn("created_at", db.driver);
  const rows = await db
    .prepare(`SELECT payload FROM users ORDER BY ${orderBy}`)
    .all<{ payload: string }>();

  return rows.map((row) => userSchema.parse(JSON.parse(row.payload)));
}

async function migrateWorkspaceScope(db: Parameters<Parameters<typeof withDatabase>[0]>[0]) {
  const meetingRows = await db.prepare("SELECT payload FROM meetings").all<{ payload: string }>();
  const userRows = await db.prepare("SELECT payload FROM users").all<{ payload: string }>();

  await db.transaction(async (tx) => {
    const updateMeeting = tx.prepare("UPDATE meetings SET payload = ? WHERE id = ?");
    const updateUser = tx.prepare("UPDATE users SET payload = ? WHERE id = ?");

    for (const row of meetingRows) {
      const meeting = meetingRecordSchema.parse(JSON.parse(row.payload));
      if (!meeting.workspaceId) {
        await updateMeeting.run(JSON.stringify({ ...meeting, workspaceId: DEFAULT_WORKSPACE_ID }), meeting.id);
      }
    }

    for (const row of userRows) {
      const user = userSchema.parse(JSON.parse(row.payload));
      if (!user.workspaceId) {
        await updateUser.run(JSON.stringify({ ...user, workspaceId: DEFAULT_WORKSPACE_ID }), user.id);
      }
      if (!user.workspaceIds || user.workspaceIds.length === 0) {
        const workspaceIds = user.role === "editor"
          ? [DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID]
          : [user.workspaceId || DEFAULT_WORKSPACE_ID];
        await updateUser.run(JSON.stringify({ ...user, workspaceIds }), user.id);
      }
    }
  });
}

async function migrateSeedMeetingsOwnership(db: Parameters<Parameters<typeof withDatabase>[0]>[0]) {
  const rows = await db.prepare("SELECT payload FROM meetings").all<{ payload: string }>();
  let hasChanges = false;

  await db.transaction(async (tx) => {
    const migrateUpdate = tx.prepare("UPDATE meetings SET payload = ? WHERE id = ?");

    for (const row of rows) {
      const meeting = meetingRecordSchema.parse(JSON.parse(row.payload));
      if (!meeting.ownerUserId) {
        const updated = { ...meeting, ownerUserId: "user-admin-001" };
        await migrateUpdate.run(JSON.stringify(updated), meeting.id);
        hasChanges = true;
      }
    }
  });

  return hasChanges;
}

export async function loadUsers() {
  return withDatabase(async (db) => {
    const storedUsers = await loadUsersFromDatabase(db);
    if (storedUsers.length > 0) {
      return storedUsers;
    }

    const seedUsers = await buildSeedUsers();
    await replaceUsers(db, seedUsers);
    return [...seedUsers];
  });
}

export async function saveUsers(users: User[]) {
  await withDatabase(async (db) => {
    await replaceUsers(db, users);
  });
}

export async function findUserByEmail(email: string) {
  return withDatabase(async (db) => {
    const row = await db
      .prepare("SELECT payload FROM users WHERE email = ?")
      .get<{ payload: string }>(email);

    if (!row) {
      return undefined;
    }

    return userSchema.parse(JSON.parse(row.payload));
  });
}

export async function findUserById(id: string) {
  return withDatabase(async (db) => {
    const row = await db
      .prepare("SELECT payload FROM users WHERE id = ?")
      .get<{ payload: string }>(id);

    if (!row) {
      return undefined;
    }

    return userSchema.parse(JSON.parse(row.payload));
  });
}

export async function listStoredUsers() {
  return withDatabase(async (db) => loadUsersFromDatabase(db));
}

export async function updateUserRecord(user: User) {
  await withDatabase(async (db) => {
    const update = db.prepare("UPDATE users SET payload = ? WHERE id = ?");
    await update.run(JSON.stringify(user), user.id);
  });
}

export async function createUser(
  email: string,
  name: string,
  passwordHash: string,
  role: User["role"] = "editor",
  workspaceId: string = DEFAULT_WORKSPACE_ID
) {
  const user = await withDatabase(async (db) => {
    const now = new Date().toISOString();
    const nextUser: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      email: email.toLowerCase(),
      name,
      passwordHash,
      role,
      workspaceId,
      workspaceIds: workspaceId === DEFAULT_WORKSPACE_ID && role === "editor"
        ? [DEFAULT_WORKSPACE_ID, TEAM_B_WORKSPACE_ID]
        : [workspaceId],
      createdAt: now,
      updatedAt: now
    };

    const insert = db.prepare(`
      INSERT INTO users (id, email, payload, created_at)
      VALUES (?, ?, ?, ?)
    `);

    await insert.run(nextUser.id, nextUser.email, JSON.stringify(nextUser), nextUser.createdAt);
    return nextUser;
  });

  const { upsertMembership } = await import("./workspaceMemberStore.js");
  const memberRole = role === "viewer" ? "viewer" : role === "admin" ? "admin" : "editor";
  for (const id of user.workspaceIds) {
    await upsertMembership({ workspaceId: id, userId: user.id, role: memberRole });
  }

  return user;
}

export async function migrateExistingMeetings() {
  await withDatabase(async (db) => {
    await migrateSeedMeetingsOwnership(db);
    await migrateWorkspaceScope(db);
  });

  const { backfillWorkspaceMemberships } = await import("./workspaceMemberStore.js");
  const users = await loadUsers();
  await backfillWorkspaceMemberships(users);
}

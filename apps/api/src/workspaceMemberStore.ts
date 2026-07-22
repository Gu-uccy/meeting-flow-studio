import {
  DEFAULT_WORKSPACE_ID,
  workspaceMemberRoleSchema,
  workspaceMembershipSchema,
  type User,
  type UserRole,
  type WorkspaceMemberRole,
  type WorkspaceMembership,
  type WorkspaceMembershipRef
} from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";

function mapMembershipRoleFromUser(user: Pick<User, "role">): WorkspaceMemberRole {
  if (user.role === "viewer") {
    return "viewer";
  }
  if (user.role === "admin") {
    return "admin";
  }
  return "editor";
}

export async function listMembershipsForWorkspace(workspaceId: string): Promise<WorkspaceMembership[]> {
  return withDatabase(async (db) => {
    const rows = await db
      .prepare(
        `SELECT workspace_id, user_id, role, created_at, updated_at
         FROM workspace_members
         WHERE workspace_id = ?
         ORDER BY created_at ASC`
      )
      .all<{
        workspace_id: string;
        user_id: string;
        role: string;
        created_at: string;
        updated_at: string;
      }>(workspaceId);

    return rows.map((row) =>
      workspaceMembershipSchema.parse({
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: workspaceMemberRoleSchema.parse(row.role),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    );
  });
}

export async function listMembershipsForUser(userId: string): Promise<WorkspaceMembershipRef[]> {
  return withDatabase(async (db) => {
    const rows = await db
      .prepare(
        `SELECT workspace_id, role
         FROM workspace_members
         WHERE user_id = ?
         ORDER BY created_at ASC`
      )
      .all<{ workspace_id: string; role: string }>(userId);

    return rows.map((row) => ({
      workspaceId: row.workspace_id,
      role: workspaceMemberRoleSchema.parse(row.role)
    }));
  });
}

export async function getMembershipRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMemberRole | null> {
  return withDatabase(async (db) => {
    const row = await db
      .prepare(
        `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
      )
      .get<{ role: string }>(workspaceId, userId);

    if (!row) {
      return null;
    }
    return workspaceMemberRoleSchema.parse(row.role);
  });
}

export async function upsertMembership(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
}): Promise<WorkspaceMembership> {
  const now = new Date().toISOString();

  return withDatabase(async (db) => {
    const existing = await db
      .prepare(
        `SELECT created_at FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
      )
      .get<{ created_at: string }>(input.workspaceId, input.userId);

    const createdAt = existing?.created_at ?? now;

    await db
      .prepare(
        `INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, user_id) DO UPDATE SET
           role = excluded.role,
           updated_at = excluded.updated_at`
      )
      .run(input.workspaceId, input.userId, input.role, createdAt, now);

    return workspaceMembershipSchema.parse({
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      createdAt,
      updatedAt: now
    });
  });
}

export async function removeMembership(workspaceId: string, userId: string): Promise<boolean> {
  return withDatabase(async (db) => {
    const result = await db
      .prepare(`DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`)
      .run(workspaceId, userId);
    return (result.changes ?? 0) > 0;
  });
}

export async function deleteMembershipsForWorkspace(workspaceId: string): Promise<void> {
  await withDatabase(async (db) => {
    await db.prepare(`DELETE FROM workspace_members WHERE workspace_id = ?`).run(workspaceId);
  });
}

export async function countAdminsInWorkspace(workspaceId: string): Promise<number> {
  return withDatabase(async (db) => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ? AND role = 'admin'`
      )
      .get<{ count: number | string }>(workspaceId);
    return Number(row?.count ?? 0);
  });
}

export async function syncUserWorkspaceIdsFromMemberships(
  user: User,
  updateUser: (next: User) => Promise<void>
): Promise<User> {
  const memberships = await listMembershipsForUser(user.id);
  const workspaceIds = memberships.map((item) => item.workspaceId);
  const nextIds = workspaceIds.length > 0 ? workspaceIds : [user.workspaceId || DEFAULT_WORKSPACE_ID];
  const nextWorkspaceId = nextIds.includes(user.workspaceId)
    ? user.workspaceId
    : (nextIds[0] ?? DEFAULT_WORKSPACE_ID);

  if (
    nextWorkspaceId === user.workspaceId &&
    nextIds.length === (user.workspaceIds ?? []).length &&
    nextIds.every((id) => (user.workspaceIds ?? []).includes(id))
  ) {
    return user;
  }

  const updated: User = {
    ...user,
    workspaceId: nextWorkspaceId,
    workspaceIds: nextIds,
    updatedAt: new Date().toISOString()
  };
  await updateUser(updated);
  return updated;
}

/**
 * One-time backfill: create workspace_members rows from User.workspaceIds / workspaceId.
 */
export async function backfillWorkspaceMemberships(users: User[]): Promise<void> {
  await withDatabase(async (db) => {
    const existingCount = await db
      .prepare(`SELECT COUNT(*) AS count FROM workspace_members`)
      .get<{ count: number | string }>();

    if (Number(existingCount?.count ?? 0) > 0) {
      return;
    }

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      const insert = tx.prepare(
        `INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, user_id) DO NOTHING`
      );

      for (const user of users) {
        const ids = new Set<string>([
          ...(user.workspaceIds ?? []),
          user.workspaceId || DEFAULT_WORKSPACE_ID
        ]);
        const role = mapMembershipRoleFromUser(user);
        for (const workspaceId of ids) {
          await insert.run(workspaceId, user.id, role, user.createdAt || now, now);
        }
      }
    });
  });
}

export function membershipRoleRank(role: UserRole): number {
  if (role === "admin") return 3;
  if (role === "editor") return 2;
  return 1;
}

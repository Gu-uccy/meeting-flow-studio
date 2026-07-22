import { seedWorkspaces, workspaceSchema, type Workspace } from "@meeting-flow/shared";
import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";

export async function loadWorkspaces() {
  return withDatabase(async (db) => {
    const orderBy = orderByTimestampColumn("created_at", db.driver);
    const rows = await db
      .prepare(`SELECT payload FROM workspaces ORDER BY ${orderBy}`)
      .all<{ payload: string }>();

    if (rows.length > 0) {
      const stored = rows.map((row) => workspaceSchema.parse(JSON.parse(row.payload)));
      const missingSeeds = seedWorkspaces.filter((seed) => !stored.some((item) => item.id === seed.id));
      if (missingSeeds.length > 0) {
        await replaceWorkspaces(db, [...stored, ...missingSeeds]);
        return [...stored, ...missingSeeds];
      }
      return stored;
    }

    await replaceWorkspaces(db, seedWorkspaces);
    return [...seedWorkspaces];
  });
}

export async function findWorkspaceById(id: string) {
  const workspaces = await loadWorkspaces();
  return workspaces.find((workspace) => workspace.id === id);
}

async function replaceWorkspaces(db: Parameters<Parameters<typeof withDatabase>[0]>[0], workspaces: Workspace[]) {
  await db.transaction(async (tx) => {
    const insert = tx.prepare(`
      INSERT INTO workspaces (id, payload, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        created_at = excluded.created_at
    `);

    for (const workspace of workspaces) {
      await insert.run(workspace.id, JSON.stringify(workspace), workspace.createdAt);
    }
  });
}

function buildWorkspaceSlug(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `workspace-${suffix}`;
}

export async function createWorkspace(input: { name: string }) {
  const now = new Date().toISOString();
  const workspace: Workspace = {
    id: `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    slug: buildWorkspaceSlug(input.name),
    createdAt: now,
    updatedAt: now
  };

  await withDatabase(async (db) => {
    const insert = db.prepare(`
      INSERT INTO workspaces (id, payload, created_at)
      VALUES (?, ?, ?)
    `);
    await insert.run(workspace.id, JSON.stringify(workspace), workspace.createdAt);
  });

  return workspace;
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new Error("未找到工作区");
  }

  const updated: Workspace = {
    ...workspace,
    name: name.trim(),
    updatedAt: new Date().toISOString()
  };

  await withDatabase(async (db) => {
    await db
      .prepare(`
        UPDATE workspaces
        SET payload = ?, created_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(updated), updated.createdAt, updated.id);
  });

  return updated;
}

export function isSeedWorkspace(workspaceId: string) {
  return seedWorkspaces.some((workspace) => workspace.id === workspaceId);
}

export async function deleteWorkspace(workspaceId: string) {
  if (isSeedWorkspace(workspaceId)) {
    throw new Error("系统预置工作区不可删除");
  }

  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new Error("未找到工作区");
  }

  const { deleteMembershipsForWorkspace } = await import("./workspaceMemberStore.js");
  await deleteMembershipsForWorkspace(workspaceId);

  await withDatabase(async (db) => {
    await db.prepare("DELETE FROM workspaces WHERE id = ?").run(workspaceId);
  });

  return workspace;
}

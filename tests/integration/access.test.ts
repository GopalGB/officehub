import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { projectAccessWhere } from "@/lib/rbac";
import { taskFilters } from "@/lib/filters";

// Deliberately opt in to a separate test schema, never the application's database.
const url = process.env.OFFICEHUB_TEST_DATABASE_URL;
if (!url || !new URL(url).searchParams.get("schema")?.startsWith("officehub_test_")) {
  throw new Error("Set OFFICEHUB_TEST_DATABASE_URL to an initialized officehub_test_* schema");
}
process.env.DATABASE_URL = url;
const db = new PrismaClient({ datasourceUrl: url });
const suffix = randomUUID();
const userIds: string[] = [];
let ownerId: string;
let collaboratorId: string;
let outsiderId: string;
let projectId: string;
let pageId: string;
let taskId: string;

before(async () => {
  for (const name of ["owner", "collaborator", "outsider"]) {
    const user = await db.user.create({ data: { email: `${name}-${suffix}@test.invalid`, name, passwordHash: "test-only", role: "MEMBER" } });
    userIds.push(user.id);
  }
  [ownerId, collaboratorId, outsiderId] = userIds;
  const project = await db.project.create({ data: { title: suffix, ownerId, members: { connect: { id: collaboratorId } } } });
  projectId = project.id;
  const task = await db.task.create({ data: { title: suffix, projectId, assigneeId: ownerId, reporterId: ownerId } });
  taskId = task.id;
  const page = await db.page.create({ data: { title: suffix, authorId: ownerId } });
  pageId = page.id;
});

after(async () => {
  await db.project.deleteMany({ where: { id: projectId ?? "" } });
  await db.page.deleteMany({ where: { id: pageId ?? "" } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  const { db: appDb } = await import("@/lib/db");
  await appDb.$disconnect();
  await db.$disconnect();
});

void test("database project reads include collaborators and exclude outsiders", async () => {
  for (const [id, expected] of [[collaboratorId, 1], [outsiderId, 0]] as const) {
    assert.equal(await db.project.count({ where: { id: projectId, AND: [projectAccessWhere({ id, role: "MEMBER" })] } }), expected);
  }
});

void test("forged scopes and project filters cannot retrieve a foreign task", async () => {
  for (const scope of ["unexpected", "reported", "all", "projects", "mine"]) {
    const { where } = taskFilters({ id: outsiderId, role: "MEMBER" }, { scope, project: projectId });
    assert.equal(await db.task.count({ where }), 0);
  }
  const { where } = taskFilters({ id: collaboratorId, role: "MEMBER" }, { scope: "projects", project: projectId });
  assert.deepEqual((await db.task.findMany({ where })).map((task) => task.id), [taskId]);
});

void test("shared project write guard rejects outsiders and permits collaborators", async () => {
  const { requireProjectEditor } = await import("@/lib/access");
  await assert.rejects(requireProjectEditor({ id: outsiderId, role: "MEMBER" }, projectId), /Forbidden/);
  assert.equal((await requireProjectEditor({ id: collaboratorId, role: "MEMBER" }, projectId)).id, projectId);
});

void test("shared wiki write guard enforces author ownership", async () => {
  const { requirePageEditor } = await import("@/lib/access");
  await assert.rejects(requirePageEditor({ id: outsiderId, role: "MEMBER" }, pageId), /Forbidden/);
  assert.equal((await requirePageEditor({ id: ownerId, role: "MEMBER" }, pageId)).id, pageId);
});

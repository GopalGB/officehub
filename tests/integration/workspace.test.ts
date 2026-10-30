import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { projectAccessWhere } from "@/lib/rbac";
const url = process.env.OFFICEHUB_TEST_DATABASE_URL;
if (
  !url ||
  !new URL(url).searchParams.get("schema")?.startsWith("officehub_test_")
)
  throw new Error("Use a separate officehub_test_* schema");
process.env.DATABASE_URL = url;
const db = new PrismaClient({ datasourceUrl: url });
const suffix = randomUUID();
const ids: string[] = [];
let projectId = "";
let userId: string;
let coOwnerId: string;
before(async () => {
  for (const name of ["owner", "co-owner", "outsider"]) {
    const user = await db.user.create({
      data: {
        email: `${name}-${suffix}@test.invalid`,
        name,
        passwordHash: "test-only",
      },
    });
    ids.push(user.id);
  }
  [userId, coOwnerId] = ids;
  const project = await db.project.create({
    data: { title: suffix, ownerId: userId, coOwnerId },
  });
  projectId = project.id;
});
after(async () => {
  try {
    if (projectId) {
      await db.auditLog.deleteMany({ where: { projectId } });
      await db.project.deleteMany({ where: { id: projectId } });
    }
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await db.$disconnect();
  }
});
void test("co-owner access is enforced by both database predicate and shared write guard", async () => {
  const { requireProjectEditor } = await import("@/lib/access");
  assert.equal(
    await db.project.count({
      where: {
        id: projectId,
        AND: [projectAccessWhere({ id: coOwnerId, role: "MEMBER" })],
      },
    }),
    1,
  );
  assert.equal(
    (await requireProjectEditor({ id: coOwnerId, role: "MEMBER" }, projectId))
      .id,
    projectId,
  );
  await assert.rejects(
    requireProjectEditor({ id: ids[2], role: "MEMBER" }, projectId),
    /Forbidden/,
  );
});
void test("sub-owners cannot transfer ownership or grant project membership", async () => {
  const { reviseProject } = await import("@/lib/history");
  const actor = { id: coOwnerId, role: "MEMBER" as const };
  await assert.rejects(
    db.$transaction((tx) =>
      reviseProject(
        tx,
        actor,
        projectId,
        { owner: { connect: { id: coOwnerId } } },
        "Forged transfer",
        1,
      ),
    ),
    /Only the owner or a manager/,
  );
  await assert.rejects(
    db.$transaction((tx) =>
      reviseProject(
        tx,
        actor,
        projectId,
        { members: { connect: { id: ids[2] } } },
        "Forged roster",
        1,
      ),
    ),
    /Only the owner or a manager/,
  );
  assert.equal(await db.projectRevision.count({ where: { projectId } }), 0);
});

void test("project changes create immutable baseline and new revision in one transaction", async () => {
  const { reviseProject } = await import("@/lib/history");
  const actor = { id: coOwnerId, role: "MEMBER" as const, name: "Sub-owner" };
  const changed = await db.$transaction((tx) =>
    reviseProject(
      tx,
      actor,
      projectId,
      { title: "Updated details", status: "COMPLETED" },
      "Test detail change",
      1,
    ),
  );
  assert.equal(changed.version, 2);
  assert.ok(changed.actualEndDate);
  const revisions = await db.projectRevision.findMany({
    where: { projectId },
    orderBy: { version: "asc" },
  });
  assert.deepEqual(
    revisions.map((r) => r.version),
    [1, 2],
  );
  assert.equal((revisions[0].snapshot as { title: string }).title, suffix);
  assert.equal(await db.auditLog.count({ where: { projectId } }), 1);
  // A stale client and an unauthorized client cannot write or add history.
  await assert.rejects(
    db.$transaction((tx) =>
      reviseProject(
        tx,
        actor,
        projectId,
        { title: "Lost update" },
        "Stale edit",
        1,
      ),
    ),
    /changed elsewhere/,
  );
  await assert.rejects(
    db.$transaction((tx) =>
      reviseProject(
        tx,
        { id: ids[2], role: "MEMBER" },
        projectId,
        { title: "Forbidden" },
        "Forged edit",
      ),
    ),
    /Forbidden/,
  );
  assert.equal(
    (await db.project.findUniqueOrThrow({ where: { id: projectId } })).title,
    "Updated details",
  );
  assert.equal(await db.projectRevision.count({ where: { projectId } }), 2);
});
void test("simultaneous versioned edits cannot silently overwrite one another", async () => {
  const { reviseProject } = await import("@/lib/history");
  const actor = { id: userId, role: "MEMBER" as const };
  const results = await Promise.allSettled(
    ["A", "B"].map((title) =>
      db.$transaction((tx) =>
        reviseProject(tx, actor, projectId, { title }, "Concurrent edit", 2),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.project.findUniqueOrThrow({ where: { id: projectId } })).version,
    3,
  );
  assert.equal(await db.projectRevision.count({ where: { projectId } }), 3);
});
void test("weekly baseline and per-date overrides persist independently", async () => {
  const plan = await db.workPlan.create({
    data: {
      userId,
      projectId,
      weekStart: new Date("2026-10-25"),
      title: "Baseline",
      weekdays: [1, 2, 3],
      hours: 2,
    },
  });
  await db.dailyOverride.create({
    data: {
      planId: plan.id,
      date: new Date("2026-10-28"),
      projectId,
      title: "Adjusted",
      hours: 4,
      startTime: "10:00",
    },
  });
  const stored = await db.workPlan.findUniqueOrThrow({
    where: { id: plan.id },
    include: { overrides: true },
  });
  assert.equal(stored.title, "Baseline");
  assert.equal(stored.overrides[0].title, "Adjusted");
  await assert.rejects(
    db.dailyOverride.create({
      data: {
        planId: plan.id,
        date: new Date("2026-10-28"),
        projectId,
        title: "Duplicate",
        hours: 4,
        startTime: "10:00",
      },
    }),
  );
  await db.workPlan.delete({ where: { id: plan.id } });
  assert.equal(await db.dailyOverride.count({ where: { planId: plan.id } }), 0);
});

void test("extra project columns persist in history and survive unrelated edits", async () => {
  const { reviseProject } = await import("@/lib/history");
  const before = await db.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const fields = [
    { label: "Source system", value: String.raw`\\server\reports\input.xlsx` },
    { label: "External reference", value: "000042" },
  ];
  const changed = await db.$transaction((tx) =>
    reviseProject(
      tx,
      { id: userId, role: "MEMBER" },
      projectId,
      { additionalDetails: fields, subTeam: "Planning" },
      "Additional spreadsheet details saved",
      before.version,
    ),
  );
  assert.deepEqual(changed.additionalDetails, fields);
  const revision = await db.projectRevision.findUniqueOrThrow({
    where: { projectId_version: { projectId, version: changed.version } },
  });
  assert.deepEqual(
    (revision.snapshot as { additionalDetails: unknown }).additionalDetails,
    fields,
  );
  const edited = await db.$transaction((tx) =>
    reviseProject(
      tx,
      { id: userId, role: "MEMBER" },
      projectId,
      { summary: "Unrelated detail" },
      "Summary updated",
      changed.version,
    ),
  );
  assert.deepEqual(edited.additionalDetails, fields);
  assert.equal(edited.subTeam, "Planning");
});

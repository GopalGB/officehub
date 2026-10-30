import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { parseProjectSheet } from "@/lib/project-import";

const url = process.env.OFFICEHUB_TEST_DATABASE_URL;
if (
  !url ||
  !new URL(url).searchParams.get("schema")?.startsWith("officehub_test_")
)
  throw new Error("Use a separate officehub_test_* schema");
process.env.DATABASE_URL = url;
const db = new PrismaClient({ datasourceUrl: url });
const suffix = randomUUID();
const users: string[] = [];
let actor: { id: string; role: "MANAGER" };
let ownerId = "",
  adminId = "";
before(async () => {
  for (const role of ["MANAGER", "MEMBER", "ADMIN"] as const) {
    const user = await db.user.create({
      data: {
        email: `import-${role}-${suffix}@test.invalid`,
        name: role,
        role,
        passwordHash: "test-only",
      },
    });
    users.push(user.id);
  }
  actor = { id: users[0], role: "MANAGER" };
  ownerId = users[1];
  adminId = users[2];
});
after(async () => {
  try {
    if (users.length) {
      const projects = await db.project.findMany({
        where: { ownerId: { in: users } },
        select: { id: true },
      });
      await db.auditLog.deleteMany({
        where: { projectId: { in: projects.map((item) => item.id) } },
      });
      await db.project.deleteMany({
        where: { id: { in: projects.map((item) => item.id) } },
      });
      await db.projectImport.deleteMany({ where: { actorId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
  } finally {
    await db.$disconnect();
  }
});
function workbook(
  label: string,
  status = "Completed",
  notes = "1. Original change",
  hours = "100",
) {
  return {
    fileName: "synthetic.xlsx",
    sheetName: "Projects",
    rows: parseProjectSheet([
      [
        "No.",
        "Project",
        "Impact",
        "Status",
        "Time saved (hrs/year)",
        "Enhancement details",
        "Reference",
      ],
      ["001", `${label}-${suffix}`, "High", status, hours, notes, "000042"],
    ]),
  };
}
const service = () => import("@/lib/project-import-service");
void test("the documented maximum imports 200 projects and 10,000 audited timeline changes within one transaction", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const source = `maximum-${suffix}`;
  const rows = parseProjectSheet([
    [
      "No.",
      "Project",
      "Status",
      "Recorded enhancement iterations",
      "Enhancement details",
    ],
    ...Array.from({ length: 200 }, (_, index) => [
      String(index),
      `Bulk project ${index}-${suffix}`,
      "Completed",
      "50",
      Array.from(
        { length: 50 },
        (_, change) => `${change + 1}. Recorded change ${change + 1}`,
      ).join("\n"),
    ]),
  ]);
  const preview = await prepareProjectImport(
    actor,
    { source, ownerId },
    { fileName: "synthetic-maximum.xlsx", sheetName: "Projects", rows },
  );
  const result = await applyProjectImport(actor, preview.id, false);
  assert.deepEqual(result, {
    created: 200,
    updated: 0,
    skipped: 0,
    changesAdded: 10000,
  });
  const records = await db.projectImportRecord.findMany({
    where: { source: `${source}::projects` },
    select: { projectId: true },
  });
  const projectIds = records.map((record) => record.projectId);
  assert.equal(
    await db.enhancement.count({ where: { projectId: { in: projectIds } } }),
    10000,
  );
  assert.equal(
    await db.auditLog.count({
      where: { projectId: { in: projectIds }, entity: "Enhancement" },
    }),
    10000,
  );
  assert.deepEqual(
    (await db.projectImport.findUniqueOrThrow({ where: { id: preview.id } }))
      .rows,
    [],
  );
});
void test("renamed imported references cannot collide with another project", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const source = `names-${suffix}`,
    data = workbook("Rename source");
  const preview = await prepareProjectImport(actor, { source, ownerId }, data);
  await applyProjectImport(actor, preview.id, false);
  const other = await db.project.create({
    data: { title: `Occupied name-${suffix}`, ownerId },
  });
  const renamed = { ...data, rows: [{ ...data.rows[0], title: other.title }] };
  const conflict = await prepareProjectImport(
    actor,
    { source, ownerId },
    renamed,
  );
  assert.equal(conflict.rows[0].disposition, "conflict");
  assert.equal((await applyProjectImport(actor, conflict.id, true)).skipped, 1);
  const fresh = workbook("Concurrent name");
  const freshPreview = await prepareProjectImport(
    actor,
    { source: `concurrent-name-${suffix}`, ownerId },
    fresh,
  );
  await db.project.create({ data: { title: fresh.rows[0].title, ownerId } });
  await assert.rejects(
    applyProjectImport(actor, freshPreview.id, true),
    /matches another project/,
  );
});
void test("preview does not create projects; commit and retry are atomic and idempotent with saved history", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const data = workbook("First");
  const preview = await prepareProjectImport(
    actor,
    { source: `first-${suffix}`, ownerId },
    data,
  );
  assert.equal(
    await db.project.count({ where: { title: data.rows[0].title } }),
    0,
  );
  const result = await applyProjectImport(actor, preview.id, false);
  assert.deepEqual(result, {
    created: 1,
    updated: 0,
    skipped: 0,
    changesAdded: 1,
  });
  assert.deepEqual(await applyProjectImport(actor, preview.id, true), result);
  const project = await db.project.findFirstOrThrow({
    where: { title: data.rows[0].title },
    include: { enhancements: true, revisions: true },
  });
  assert.equal(project.ownerId, ownerId);
  assert.equal(project.actualEndDate, null);
  assert.equal(project.startDate, null);
  assert.equal(project.enhancements[0].completedAt, null);
  assert.equal(project.enhancements[0].status, "DONE");
  assert.equal(project.revisions.length, 1);
  const again = await prepareProjectImport(
    actor,
    { source: `first-${suffix}`, ownerId },
    data,
  );
  assert.equal(again.rows[0].disposition, "unchanged");
  assert.equal((await applyProjectImport(actor, again.id, true)).skipped, 1);
  assert.equal(
    await db.enhancement.count({ where: { projectId: project.id } }),
    1,
  );
});
void test("updates preserve manual fields, assignments, dates and existing timeline changes; blank values never clear", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const source = `updates-${suffix}`,
    data = workbook("Updated");
  const preview = await prepareProjectImport(actor, { source, ownerId }, data);
  await applyProjectImport(actor, preview.id, false);
  const project = await db.project.findFirstOrThrow({
    where: { title: data.rows[0].title },
    include: { enhancements: true },
  });
  await db.project.update({
    where: { id: project.id },
    data: {
      summary: "Keep summary",
      startDate: new Date("2026-01-01"),
      targetDate: new Date("2026-01-20"),
      coOwnerId: actor.id,
      members: { connect: { id: actor.id } },
      additionalDetails: [
        ...data.rows[0].additionalDetails,
        { label: "Manual field", value: "keep" },
      ],
    },
  });
  await db.enhancement.update({
    where: { id: project.enhancements[0].id },
    data: { title: "Manually refined change", version: { increment: 1 } },
  });
  const changedData = workbook(
    "Updated",
    "In progress",
    "1. Changed source text\n2. New iteration",
    "",
  );
  const updated = await prepareProjectImport(
    actor,
    { source, ownerId: actor.id },
    changedData,
  );
  assert.equal((await applyProjectImport(actor, updated.id, true)).updated, 1);
  const saved = await db.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { members: true, enhancements: true, revisions: true },
  });
  assert.equal(saved.status, "IN_PROGRESS");
  assert.equal(saved.ownerId, ownerId);
  assert.equal(saved.coOwnerId, actor.id);
  assert.equal(saved.summary, "Keep summary");
  assert.equal(saved.savedHours, 100);
  assert.equal(saved.startDate?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(saved.targetDate?.toISOString(), "2026-01-20T00:00:00.000Z");
  assert.equal(saved.members[0].id, actor.id);
  assert.equal(saved.enhancements.length, 2);
  assert.ok(
    saved.enhancements.some(
      (change) => change.title === "Manually refined change",
    ),
  );
  assert.ok(
    (saved.additionalDetails as { label: string }[]).some(
      (field) => field.label === "Manual field",
    ),
  );
  assert.equal(saved.revisions.length, 2);
});
void test("manual title matches are skipped by default and can be explicitly updated", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const data = workbook("Manual");
  const manual = await db.project.create({
    data: { title: data.rows[0].title, ownerId },
  });
  const options = { source: `manual-${suffix}`, ownerId };
  const preview = await prepareProjectImport(actor, options, data);
  assert.equal(preview.rows[0].projectId, manual.id);
  assert.equal((await applyProjectImport(actor, preview.id, false)).skipped, 1);
  assert.equal(
    (await db.project.findUniqueOrThrow({ where: { id: manual.id } })).version,
    1,
  );
  const reviewed = await prepareProjectImport(actor, options, data);
  assert.equal((await applyProjectImport(actor, reviewed.id, true)).updated, 1);
  assert.equal(await db.project.count({ where: { title: manual.title } }), 1);
});
void test("stale previews roll back the whole import including earlier new rows", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const data = workbook("Stale");
  const manual = await db.project.create({
    data: { title: data.rows[0].title, ownerId },
  });
  const newRow = { ...workbook("Rollback").rows[0], key: "002" };
  const preview = await prepareProjectImport(
    actor,
    { source: `stale-${suffix}`, ownerId },
    { ...data, rows: [newRow, ...data.rows] },
  );
  await db.project.update({
    where: { id: manual.id },
    data: { summary: "Concurrent edit", version: { increment: 1 } },
  });
  await assert.rejects(
    applyProjectImport(actor, preview.id, true),
    /changed after preview/,
  );
  assert.equal(await db.project.count({ where: { title: newRow.title } }), 0);
  assert.equal(
    (await db.projectImport.findUniqueOrThrow({ where: { id: preview.id } }))
      .appliedAt,
    null,
  );
});
void test("members, inactive managers, another manager's draft, and admin allocations are rejected", async () => {
  const { prepareProjectImport, applyProjectImport } = await service();
  const data = workbook("Permissions"),
    options = { source: `permissions-${suffix}`, ownerId };
  await assert.rejects(
    prepareProjectImport({ id: ownerId, role: "MEMBER" }, options, data),
    /Only managers/,
  );
  await assert.rejects(
    prepareProjectImport(actor, { ...options, ownerId: adminId }, data),
    /Admin/,
  );
  const preview = await prepareProjectImport(actor, options, data);
  await assert.rejects(
    applyProjectImport({ id: adminId, role: "ADMIN" }, preview.id, true),
    /unavailable/,
  );
  await db.user.update({ where: { id: actor.id }, data: { active: false } });
  await assert.rejects(
    applyProjectImport(actor, preview.id, true),
    /Only managers/,
  );
  await db.user.update({ where: { id: actor.id }, data: { active: true } });
  await db.projectImport.update({
    where: { id: preview.id },
    data: { expiresAt: new Date(0) },
  });
  await assert.rejects(applyProjectImport(actor, preview.id, true), /expired/);
});

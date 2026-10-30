import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { projectBoardFilters } from "@/lib/project-board";
import { projectBoardCSV } from "@/lib/project-csv";
import { summarizePeopleProjects } from "@/lib/project-summary";

const url = process.env.OFFICEHUB_TEST_DATABASE_URL;
if (
  !url ||
  !new URL(url).searchParams.get("schema")?.startsWith("officehub_test_")
)
  throw new Error("Use a separate officehub_test_* schema");
const db = new PrismaClient({ datasourceUrl: url });
const suffix = randomUUID(),
  users: string[] = [],
  projects: string[] = [];
before(async () => {
  for (const role of ["MEMBER", "MEMBER", "MANAGER"] as const) {
    const user = await db.user.create({
      data: {
        name: role,
        role,
        email: `board-${users.length}-${suffix}@test.invalid`,
        passwordHash: "test-only",
      },
    });
    users.push(user.id);
  }
  for (const assignment of [
    "owner",
    "sub-owner",
    "collaborator",
    "foreign",
    "archived",
  ]) {
    const record = await db.project.create({
      data: {
        title: `${assignment}-${suffix}`,
        ownerId: assignment === "owner" ? users[0] : users[1],
        coOwnerId: assignment === "sub-owner" ? users[0] : null,
        members:
          assignment === "collaborator"
            ? { connect: { id: users[0] } }
            : undefined,
        status:
          assignment === "archived"
            ? "ARCHIVED"
            : assignment === "owner"
              ? "COMPLETED"
              : "IN_PROGRESS",
      },
    });
    projects.push(record.id);
  }
});
after(async () => {
  try {
    await db.project.deleteMany({ where: { id: { in: projects } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
  } finally {
    await db.$disconnect();
  }
});
void test("members export only owned, sub-owned and explicitly shared projects even with forged filters", async () => {
  for (const scope of ["all", "unknown", "mine"]) {
    const filter = projectBoardFilters(
      { id: users[0], role: "MEMBER" },
      { scope },
    );
    const rows = await db.project.findMany({
      where: { AND: [filter.where, { id: { in: projects } }] },
      include: { owner: true, coOwner: true, members: true },
    });
    assert.deepEqual(
      new Set(rows.map((row) => row.id)),
      new Set(projects.slice(0, 3)),
    );
    const csv = projectBoardCSV(rows);
    assert.ok(
      !csv.includes(`foreign-${suffix}`) && !csv.includes(`archived-${suffix}`),
    );
    const ownFilter = projectBoardFilters(
      { id: users[0], role: "MEMBER" },
      { scope, owner: users[1] },
    );
    assert.equal(
      await db.project.count({
        where: { AND: [ownFilter.where, { id: projects[3] }] },
      }),
      0,
    );
  }
});
void test("manager all-work and owner filters cover others' work and CSV matches the authorized rows", async () => {
  const { where } = projectBoardFilters(
    { id: users[2], role: "MANAGER" },
    { scope: "all", owner: users[1] },
  );
  const rows = await db.project.findMany({
    where: { AND: [where, { id: { in: projects } }] },
    include: { owner: true, coOwner: true, members: true },
  });
  assert.deepEqual(
    new Set(rows.map((row) => row.id)),
    new Set(projects.slice(1, 4)),
  );
  assert.ok(projectBoardCSV(rows).includes(`foreign-${suffix}`));
});
void test("summary counts completed and remaining work across ownership and collaboration", async () => {
  const rows = await db.project.findMany({
    where: { id: { in: projects } },
    include: { members: { select: { id: true } } },
  });
  const summary = summarizePeopleProjects(
    [{ id: users[0], name: "Member" }],
    rows,
    new Date(),
  );
  assert.equal(summary[0].total, 3);
  assert.equal(summary[0].completed, 1);
  assert.equal(summary[0].remaining, 2);
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  assertAssignablePeople,
  assignablePeopleWhere,
} from "@/lib/project-people";
import { requestDetailsSelect } from "@/lib/request-details";
import { readSopUpload } from "@/lib/sop-upload";

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
let projectId: string, linkId: string, requestId: string;
before(async () => {
  for (const [name, role, active] of [
    ["owner", "MEMBER", true],
    ["admin", "ADMIN", true],
    ["inactive", "MEMBER", false],
    ["manager", "MANAGER", true],
  ] as const) {
    const person = await db.user.create({
      data: {
        name,
        role,
        active,
        email: `${name}-${suffix}@test.invalid`,
        passwordHash: "test-only",
      },
    });
    ids.push(person.id);
  }
  projectId = (
    await db.project.create({ data: { title: suffix, ownerId: ids[0] } })
  ).id;
  linkId = (
    await db.requestLink.create({
      data: {
        label: suffix,
        managerId: ids[3],
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })
  ).id;
});
after(async () => {
  await db.projectRequest.deleteMany({ where: { linkId } });
  await db.requestLink.deleteMany({ where: { id: linkId } });
  await db.auditLog.deleteMany({ where: { projectId } });
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
void test("allocation lists and server guards exclude Admin and inactive accounts", async () => {
  const people = await db.user.findMany({
    where: { ...assignablePeopleWhere, id: { in: ids } },
    select: { id: true },
  });
  assert.deepEqual(people.map((p) => p.id).sort(), [ids[0], ids[3]].sort());
  await assertAssignablePeople([ids[0], ids[3]], db);
  await assert.rejects(assertAssignablePeople([ids[1]], db), /Admin accounts/);
  await assert.rejects(
    assertAssignablePeople([ids[2]], db),
    /active team members/,
  );
});
void test("forged ownership, sub-owner, and collaborator changes cannot allocate Admin", async () => {
  const { reviseProject } = await import("@/lib/history");
  for (const data of [
    { owner: { connect: { id: ids[1] } } },
    { coOwner: { connect: { id: ids[1] } } },
    { members: { set: [{ id: ids[1] }] } },
    { members: { connect: { id: ids[1] } } },
  ])
    await assert.rejects(
      db.$transaction((tx) =>
        reviseProject(
          tx,
          { id: ids[3], role: "MANAGER" },
          projectId,
          data,
          "Invalid allocation",
        ),
      ),
      /Admin accounts/,
    );
  assert.equal(await db.projectRevision.count({ where: { projectId } }), 0);
  assert.equal(
    (await db.project.findUniqueOrThrow({ where: { id: projectId } })).version,
    1,
  );
});
void test("request details and uploaded SOP persist while summary queries omit file bytes", async () => {
  const upload = await readSopUpload(
    new File(["%PDF-1.7\nTest process"], "Process SOP.pdf"),
  );
  assert.ok(upload);
  const request = await db.projectRequest.create({
    data: {
      ...upload,
      linkId,
      projectId,
      submitterName: "Requester",
      submitterEmail: "requester@test.invalid",
      managerName: "Requester Manager",
      department: "BI",
      title: "Automation request",
      description: "Improve reporting process",
      projectType: "NEW_PROJECT",
      estimatedHours: 4,
      sopLocation: String.raw`\\fileserver\BI\SOP.pdf`,
      requiredFilesLocation: String.raw`D:\Input\Sales.xlsx`,
    },
    select: requestDetailsSelect,
  });
  requestId = request.id;
  assert.equal(request.managerName, "Requester Manager");
  assert.equal(request.department, "BI");
  assert.equal(request.sopLocation, String.raw`\\fileserver\BI\SOP.pdf`);
  assert.ok(!("sopFileData" in request));
  const stored = await db.projectRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { sopFileData: true },
  });
  assert.equal(
    Buffer.from(stored.sopFileData!).toString(),
    "%PDF-1.7\nTest process",
  );
});

void test("legacy Admin-owned projects remain editable without creating new Admin allocations", async () => {
  const { reviseProject } = await import("@/lib/history");
  const legacy = await db.project.create({
    data: { title: "Legacy project", ownerId: ids[1] },
  });
  try {
    const edited = await db.$transaction((tx) =>
      reviseProject(
        tx,
        { id: ids[3], role: "MANAGER" },
        legacy.id,
        { title: "Legacy details updated" },
        "Unrelated detail edit",
      ),
    );
    assert.equal(edited.ownerId, ids[1]);
    assert.equal(edited.title, "Legacy details updated");
    await assert.rejects(
      db.$transaction((tx) =>
        reviseProject(
          tx,
          { id: ids[3], role: "MANAGER" },
          legacy.id,
          { coOwner: { connect: { id: ids[1] } } },
          "New Admin allocation",
        ),
      ),
      /Admin accounts/,
    );
  } finally {
    await db.auditLog.deleteMany({ where: { projectId: legacy.id } });
    await db.project.delete({ where: { id: legacy.id } });
  }
});

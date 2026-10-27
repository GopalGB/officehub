import assert from "node:assert/strict";
import { test } from "node:test";
import { canEditPage, canEditProject, canViewProject, projectAccessWhere, taskPermissions } from "@/lib/rbac";
import { calendarPeriod, taskFilters } from "@/lib/filters";
import { blockDocumentSchema, projectUpdateSchema, taskUpdateSchema, enhancementUpdateSchema } from "@/lib/validation";
import { formatDate, isOverdueDate } from "@/lib/utils";

const viewer = { id: "member", role: "MEMBER" as const };
const project = { ownerId: "owner", memberIds: ["collaborator"] };

void test("project isolation permits explicit collaborators but rejects unrelated members", () => {
  assert.equal(canViewProject({ ...project, viewerId: viewer.id, viewerRole: viewer.role }), false);
  assert.equal(canEditProject({ ...project, viewerId: "collaborator", viewerRole: "MEMBER" }), true);
  assert.equal(canViewProject({ ...project, viewerId: "manager", viewerRole: "MANAGER" }), true);
  assert.equal(canEditProject({ ...project, viewerId: null, viewerRole: "ADMIN" }), false);
});

void test("unknown or unauthorized task scopes cannot widen project access", () => {
  for (const scope of [undefined, "unexpected", "all", "", "ALL"]) {
    const result = taskFilters(viewer, { scope, project: "foreign" });
    assert.equal(result.scope, "mine");
    assert.deepEqual(result.where.AND, [
      { project: projectAccessWhere(viewer) }, { assigneeId: "member" }, {}, { projectId: "foreign" },
    ]);
  }
});

void test("reported and collaborator task scopes retain project restrictions", () => {
  for (const scope of ["reported", "projects"]) {
    const result = taskFilters(viewer, { scope });
    assert.deepEqual((result.where.AND as unknown[])[0], { project: projectAccessWhere(viewer) });
  }
  assert.equal(taskFilters({ ...viewer, role: "MANAGER" }, { scope: "all" }).scope, "all");
});

void test("malformed statuses fall back safely", () => {
  assert.deepEqual(taskFilters(viewer, { status: "not-a-status" }).where, taskFilters(viewer, {}).where);
});

void test("collaborators can move and assign tasks without deleting others' work", () => {
  assert.deepEqual(taskPermissions({ ...viewer, id: "collaborator" }, {
    reporterId: "reporter", assigneeId: "assignee", project: { ownerId: "owner", members: [{ id: "collaborator" }] },
  }), { canEdit: true, canAssign: true, canDelete: false });
});

void test("assignees can update/delete their task but cannot reassign outside a project they edit", () => {
  assert.deepEqual(taskPermissions(viewer, {
    reporterId: "reporter", assigneeId: "member", project: { ownerId: "owner", members: [] },
  }), { canEdit: true, canAssign: false, canDelete: true });
});

void test("wiki write access requires ownership or a manager", () => {
  assert.equal(canEditPage(viewer, "owner"), false);
  assert.equal(canEditPage(viewer, viewer.id), true);
  assert.equal(canEditPage({ ...viewer, role: "MANAGER" }, "owner"), true);
});

void test("optional dates can be cleared and impossible dates are rejected", () => {
  const parsed = projectUpdateSchema.parse({ title: "Project", startDate: "", targetDate: "" });
  assert.equal(parsed.startDate, null);
  assert.equal(parsed.targetDate, null);
  assert.equal(projectUpdateSchema.safeParse({ startDate: "2026-02-30" }).success, false);
  assert.equal(taskUpdateSchema.parse({ dueDate: "" }).dueDate, null);
});

void test("calendar rejects malformed and out-of-range periods", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  for (const [y, m] of [["bad", "bad"], ["9999999999", "12"], ["-1", "-1"]]) {
    assert.deepEqual(calendarPeriod(y, m, now), { year: 2026, month: 9 });
  }
  assert.deepEqual(calendarPeriod("2027", "0", now), { year: 2027, month: 0 });
});

void test("rich text rejects malformed document roots", () => {
  for (const value of [{}, [null], ["text"], [{ type: 123 }]]) {
    assert.equal(blockDocumentSchema.safeParse(value).success, false);
  }
  assert.equal(blockDocumentSchema.safeParse([{ type: "paragraph", content: [] }]).success, true);
});

void test("date-only labels and today's overdue state work in both UTC offsets", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["America/Los_Angeles", "Asia/Kolkata"]) {
      process.env.TZ = timezone;
      assert.equal(formatDate("2026-10-27T00:00:00Z"), "27 Oct 2026");
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      assert.equal(isOverdueDate(today), false);
      assert.equal(isOverdueDate("2000-01-01"), true);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

void test("partial edits never reset unspecified status or priority", () => {
  for (const schema of [projectUpdateSchema, taskUpdateSchema, enhancementUpdateSchema]) {
    assert.deepEqual(schema.parse({ title: "Changed title" }), { title: "Changed title" });
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, projectBoardCSV, type BoardProject } from "@/lib/project-csv";
import { projectBoardFilters } from "@/lib/project-board";
import { summarizePeopleProjects } from "@/lib/project-summary";
import {
  timelineBarPosition,
  isCompletedStage,
  isActiveStage,
} from "@/lib/timeline";
import { boundedDragTransform } from "@/components/board/dnd-helpers";

const now = new Date("2026-10-30");
function project(overrides: Partial<BoardProject> = {}): BoardProject {
  return {
    id: "one",
    title: "Sample project",
    summary: null,
    description: null,
    status: "PLANNING",
    priority: "MEDIUM",
    startDate: null,
    targetDate: null,
    actualEndDate: null,
    ownerId: "owner",
    owner: { id: "owner", name: "Sample owner" },
    coOwnerId: null,
    coOwner: null,
    projectType: "NEW_PROJECT",
    sourceProjectId: null,
    estimatedHours: null,
    savedHours: null,
    department: null,
    subTeam: null,
    additionalDetails: [],
    acceptanceCriteria: null,
    version: 1,
    members: [],
    orderIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
void test("CSV safely quotes multiline text, Unicode, quotes and formula-like spreadsheet values", () => {
  assert.equal(csvCell('A, "B"\nC'), '"A, ""B""\nC"');
  for (const value of ["=1+1", " +SUM(A1)", "\t@SUM(A1)", "-1+2", "\rText"])
    assert.equal(csvCell(value), "\"'" + value + '"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(null), '""');
  const csv = projectBoardCSV([
    project({
      title: '=HYPERLINK("https://example.invalid")',
      summary: "Catalyst — sample",
      additionalDetails: [
        { label: "Reference", value: "000042" },
        { label: "Notes", value: "line one\nline two" },
      ],
    }),
    project({
      id: "two",
      additionalDetails: [
        { label: "reference", value: "001" },
        { label: "New field", value: "+1" },
      ],
    }),
  ]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv.split("\r\n")[0].split('"Detail: Reference"').length, 2);
  assert.ok(
    csv.includes('"000042"') &&
      csv.includes('"line one\nline two"') &&
      csv.includes("Catalyst — sample"),
  );
  assert.ok(csv.includes('"\'+1"') && !csv.includes('"=HYPERLINK'));
});
void test("CSV only exports the selected fields and roster names", () => {
  const record = {
    ...project(),
    passwordHash: "private-hash",
    owner: { id: "owner", name: "Sample owner", email: "private@test.invalid" },
  };
  const csv = projectBoardCSV([record]);
  assert.ok(csv.includes("Sample owner"));
  assert.ok(
    !csv.includes("private-hash") && !csv.includes("private@test.invalid"),
  );
});
void test("board scope always retains authorization, including owner filters and unknown scope values", () => {
  const viewer = { id: "person", role: "MEMBER" as const };
  for (const scope of ["all", "mine", "unknown", undefined]) {
    const filtered = projectBoardFilters(viewer, { scope, owner: "foreign" });
    assert.equal(filtered.scope, "mine");
    assert.deepEqual((filtered.where.AND as unknown[])[2], {
      ownerId: "foreign",
    });
  }
  assert.equal(
    projectBoardFilters({ ...viewer, role: "MANAGER" }, {}).scope,
    "all",
  );
  assert.equal(
    projectBoardFilters({ ...viewer, role: "MANAGER" }, { scope: "unknown" })
      .scope,
    "mine",
  );
});
void test("person summaries deduplicate roster roles, include zero-work people and exclude archived work", () => {
  const rows = summarizePeopleProjects(
    [
      { id: "owner", name: "Owner" },
      { id: "sub", name: "Sub" },
      { id: "idle", name: "Idle" },
    ],
    [
      project({
        coOwnerId: "owner",
        members: [
          { id: "owner", name: "Owner" },
          { id: "sub", name: "Sub" },
        ],
        status: "COMPLETED",
      }),
      project({
        id: "blocked",
        status: "BLOCKED",
        targetDate: new Date("2026-10-29"),
        coOwnerId: "sub",
      }),
      project({ id: "today", status: "IN_PROGRESS", targetDate: now }),
      project({ id: "archive", status: "ARCHIVED" }),
    ],
    now,
  );
  assert.deepEqual(rows[0], {
    id: "owner",
    name: "Owner",
    total: 3,
    completed: 1,
    remaining: 2,
    planning: 0,
    inProgress: 1,
    blocked: 1,
    onHold: 0,
    overdue: 1,
  });
  assert.equal(rows[1].total, 2);
  assert.equal(rows[2].total, 0);
});
void test("drag preview stays within viewport bounds without changing its scale", () => {
  const rect = { left: 300, top: 200, width: 260, height: 150 },
    bounds = { left: 0, top: 0, width: 1000, height: 700 };
  assert.deepEqual(
    boundedDragTransform(
      { x: 1000, y: 1000, scaleX: 1, scaleY: 1 },
      rect,
      bounds,
    ),
    { x: 440, y: 350, scaleX: 1, scaleY: 1 },
  );
  assert.deepEqual(
    boundedDragTransform(
      { x: -1000, y: -1000, scaleX: 1, scaleY: 1 },
      rect,
      bounds,
    ),
    { x: -300, y: -200, scaleX: 1, scaleY: 1 },
  );
});
void test("timeline markers and durations stay inside the track at either endpoint", () => {
  const min = Date.parse("2026-10-01"),
    span = 10 * 86400000;
  for (const [start, end] of [
    ["2026-10-01", "2026-10-11"],
    ["2026-10-11", "2026-10-11"],
    ["2026-09-01", "2026-12-30"],
  ]) {
    const bar = timelineBarPosition(start, end, min, span);
    assert.ok(bar.left >= 0 && bar.width > 0 && bar.left + bar.width <= 100);
  }
});
void test("archiving unfinished work never marks delivery complete or active", () => {
  for (const status of ["DONE", "COMPLETED"]) {
    assert.equal(isCompletedStage(status), true);
    assert.equal(isActiveStage(status), false);
  }
  for (const status of ["ARCHIVED", "REJECTED"]) {
    assert.equal(isCompletedStage(status), false);
    assert.equal(isActiveStage(status), false);
  }
  for (const status of [
    "PLANNING",
    "PROPOSED",
    "APPROVED",
    "IN_PROGRESS",
    "BLOCKED",
    "ON_HOLD",
  ]) {
    assert.equal(isCompletedStage(status), false);
    assert.equal(isActiveStage(status), true);
  }
});

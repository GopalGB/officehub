import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fiscalYearStart,
  fiscalWeeks,
  fiscalPeriod,
  dateKey,
  weekStart,
} from "@/lib/fiscal";
import {
  workPlanSchema,
  publicRequestSchema,
  reportUpdateSchema,
  workspaceProjectUpdateSchema,
} from "@/lib/validation";
import { dayLoad, plannedDay, type PlanWithDays } from "@/lib/planning";
import { canEditProject, projectAccessWhere } from "@/lib/rbac";

void test("NRF year boundaries and week 53 follow 4-5-4 retail dates", () => {
  assert.equal(dateKey(fiscalYearStart(2023)), "2023-01-29");
  assert.equal(dateKey(fiscalYearStart(2024)), "2024-02-04");
  assert.equal(dateKey(fiscalYearStart(2026)), "2026-02-01");
  const weeks = fiscalWeeks(2023);
  assert.equal(weeks.length, 53);
  assert.equal(weeks.filter((w) => w.month === 12).length, 5);
  assert.equal(fiscalPeriod(new Date("2024-02-03"))?.week, 53);
  assert.equal(fiscalPeriod(new Date("2024-02-04"))?.week, 1);
  for (let year = 2000; year <= 2100; year++) {
    const rows = fiscalWeeks(year);
    assert.ok(rows.length === 52 || rows.length === 53);
    assert.equal(rows[0].start.getUTCDay(), 0);
    assert.equal(rows[rows.length - 1].end.getUTCDay(), 6);
    assert.equal(rows[4].month, 2);
    assert.equal(fiscalPeriod(rows[rows.length - 1].end)?.year, year);
  }
});
void test("custom fiscal alignment overrides NRF for dates around new year", () => {
  const config = [{ year: 2026, startDate: new Date("2026-02-08"), weeks: 52 }];
  assert.equal(dateKey(fiscalWeeks(2026, config)[0].start), "2026-02-08");
  assert.equal(fiscalPeriod(new Date("2026-02-08"), config)?.week, 1);
  assert.equal(dateKey(weekStart(new Date("2026-10-28"))), "2026-10-25");
});
function plan(overrides: PlanWithDays["overrides"] = []): PlanWithDays {
  return {
    id: "plan",
    userId: "user",
    projectId: "project",
    weekStart: new Date("2026-10-25"),
    title: "Weekly focus",
    weekdays: [1, 2, 3, 4, 5],
    hours: 2,
    startTime: "09:00",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    overrides,
  };
}
void test("daily adjustments replace one day and retain the weekly baseline", () => {
  const p = plan([
    {
      id: "override",
      planId: "plan",
      projectId: "different",
      date: new Date("2026-10-28"),
      title: "Urgent enhancement",
      hours: 3,
      startTime: "10:00",
      note: "Priority changed",
      skipped: false,
      updatedAt: new Date(),
    },
  ]);
  assert.equal(
    plannedDay(p, new Date("2026-10-28"))?.title,
    "Urgent enhancement",
  );
  assert.equal(plannedDay(p, new Date("2026-10-29"))?.title, "Weekly focus");
  assert.equal(plannedDay(p, new Date("2026-10-31")), null);
  assert.equal(plannedDay(p, new Date("2026-11-02")), null);
  assert.equal(p.title, "Weekly focus");
});
void test("workload excludes skipped work, and detects genuine time overlaps", () => {
  const p = plan(),
    second = { ...plan(), id: "two", startTime: "10:00" };
  assert.equal(dayLoad([p, second], new Date("2026-10-28")).overlap, true);
  second.startTime = "11:00";
  assert.equal(dayLoad([p, second], new Date("2026-10-28")).overlap, false);
  const skipped = plan([
    {
      id: "override",
      planId: "plan",
      projectId: "project",
      date: new Date("2026-10-28"),
      title: "Skipped",
      hours: 2,
      startTime: "09:00",
      skipped: true,
      note: null,
      updatedAt: new Date(),
    },
  ]);
  assert.equal(dayLoad([skipped], new Date("2026-10-28")).hours, 0);
});
void test("co-owners can access and edit their project without being a collaborator", () => {
  assert.equal(
    canEditProject({
      viewerRole: "MEMBER",
      viewerId: "sub",
      ownerId: "owner",
      coOwnerId: "sub",
      memberIds: [],
    }),
    true,
  );
  assert.ok(
    JSON.stringify(projectAccessWhere({ id: "sub", role: "MEMBER" })).includes(
      '"coOwnerId":"sub"',
    ),
  );
});
void test("workspace forms reject unsafe URLs and preserve optional fields on partial updates", () => {
  assert.equal(
    reportUpdateSchema.safeParse({ reportUrl: "javascript:alert(1)" }).success,
    false,
  );
  assert.deepEqual(
    workspaceProjectUpdateSchema.parse({ title: "Revised title" }),
    { title: "Revised title" },
  );
  assert.equal(
    workspaceProjectUpdateSchema.parse({ estimatedHours: "" }).estimatedHours,
    null,
  );
  assert.equal(
    workPlanSchema.safeParse({
      title: "Plan",
      projectId: "bad",
      weekStart: "not-a-date",
      weekdays: [],
      hours: 0,
      startTime: "25:00",
    }).success,
    false,
  );
  assert.equal(
    publicRequestSchema.safeParse({ title: "", estimatedHours: -1 }).success,
    false,
  );
});

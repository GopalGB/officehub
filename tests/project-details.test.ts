import assert from "node:assert/strict";
import { test } from "node:test";
import { additionalDetailsSchema } from "@/lib/additional-details";
import { deliveryRange, chronologicalStages } from "@/lib/timeline";
import { workspaceProjectUpdateSchema } from "@/lib/validation";

void test("additional spreadsheet columns preserve labels and values and reject duplicate names", () => {
  const fields = [
    { label: "Source System", value: String.raw`\\server\team\input.xlsx` },
    { label: "Business Reference", value: "000042" },
  ];
  assert.deepEqual(additionalDetailsSchema.parse(fields), fields);
  assert.equal(
    additionalDetailsSchema.safeParse([
      ...fields,
      { label: " source system ", value: "duplicate" },
    ]).success,
    false,
  );
  assert.equal(
    additionalDetailsSchema.safeParse([{ label: "", value: "orphaned" }])
      .success,
    false,
  );
  assert.equal(
    additionalDetailsSchema.safeParse([
      { label: "Too long", value: "x".repeat(5001) },
    ]).success,
    false,
  );
  assert.equal(
    workspaceProjectUpdateSchema.parse({ title: "Unrelated edit" })
      .additionalDetails,
    undefined,
  );
  assert.deepEqual(
    workspaceProjectUpdateSchema.parse({ additionalDetails: [] })
      .additionalDetails,
    [],
  );
});

void test("timeline uses a known deadline as a point when a historical project has no start date", () => {
  const range = deliveryRange({
    startDate: null,
    targetDate: new Date("2026-01-20"),
    completedAt: null,
    createdAt: new Date("2026-10-30"),
  });
  assert.equal(range.start, "2026-01-20T00:00:00.000Z");
  assert.equal(range.end, range.start);
  assert.equal(range.hasStart, false);
  assert.equal(range.hasEnd, true);
  assert.equal(range.invalidRange, false);
});
void test("missing schedule dates remain unscheduled and changes retain independent overlapping intervals", () => {
  const logged = new Date("2026-10-30");
  assert.equal(
    deliveryRange({
      startDate: null,
      targetDate: null,
      completedAt: null,
      createdAt: logged,
    }).scheduled,
    false,
  );
  const original = deliveryRange({
    startDate: new Date("2026-10-01"),
    targetDate: new Date("2026-10-20"),
    completedAt: null,
    createdAt: logged,
  });
  const changes = [5, 10, 15, 22, 25].map((day) =>
    deliveryRange({
      startDate: new Date(`2026-10-${String(day).padStart(2, "0")}`),
      targetDate: new Date(`2026-10-${String(day + 2).padStart(2, "0")}`),
      completedAt: null,
      createdAt: logged,
    }),
  );
  assert.equal(original.end, "2026-10-20T00:00:00.000Z");
  assert.equal(
    changes.filter((change) => change.start < original.end).length,
    3,
  );
  assert.equal(
    changes.filter((change) => change.start > original.end).length,
    2,
  );
  const invalid = deliveryRange({
    startDate: new Date("2026-11-20"),
    targetDate: null,
    completedAt: new Date("2026-10-30"),
    createdAt: logged,
  });
  assert.equal(invalid.invalidRange, true);
});

void test("timeline places the original first and orders changes by their scheduled dates", () => {
  const rows = [
    {
      kind: "Enhancement",
      start: "2026-10-25",
      scheduled: true,
      loggedAt: "2026-10-01",
    },
    {
      kind: "Original delivery",
      start: "2026-10-01",
      scheduled: true,
      loggedAt: "2026-10-30",
    },
    {
      kind: "Enhancement",
      start: "2026-10-05",
      scheduled: true,
      loggedAt: "2026-10-30",
    },
  ];
  assert.deepEqual(
    chronologicalStages(rows).map((row) => row.start),
    ["2026-10-01", "2026-10-05", "2026-10-25"],
  );
  assert.equal(rows[0].start, "2026-10-25");
});

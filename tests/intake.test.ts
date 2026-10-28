import assert from "node:assert/strict";
import { test } from "node:test";
import calendarWeeks from "./fixtures/company-fiscal-weeks.json";
import { fiscalWeeks, fiscalPeriod, dateKey, addDays } from "@/lib/fiscal";
import { MAX_SOP_BYTES, readSopUpload } from "@/lib/sop-upload";
import { publicRequestSchema } from "@/lib/validation";
import {
  KEEP_ASSIGNMENT,
  preserveCurrentAllocations,
} from "@/lib/allocation-form";

void test("unchanged legacy allocations are omitted while intentional allocation edits are submitted", () => {
  const fd = new FormData();
  fd.set("ownerId", KEEP_ASSIGNMENT);
  fd.set("coOwnerId", KEEP_ASSIGNMENT);
  fd.set("assigneeId", KEEP_ASSIGNMENT);
  fd.set("title", "Unrelated detail edit");
  preserveCurrentAllocations(fd);
  assert.equal(fd.has("ownerId"), false);
  assert.equal(fd.has("coOwnerId"), false);
  assert.equal(fd.has("assigneeId"), false);
  assert.equal(fd.get("title"), "Unrelated detail edit");
  fd.set("assigneeId", "");
  preserveCurrentAllocations(fd);
  assert.equal(fd.get("assigneeId"), ""); // Explicit unassignment is retained.
});

void test("every company fiscal week and period matches the supplied 2026, 2027, and 2028 PDFs", () => {
  for (const [year, expected] of Object.entries(calendarWeeks)) {
    // Stale saved settings must not displace a supplied official calendar.
    const weeks = fiscalWeeks(Number(year), [
      { year: Number(year), startDate: new Date(`${year}-02-08`), weeks: 52 },
    ]);
    assert.deepEqual(
      weeks.map((w) => [w.week, w.month, dateKey(w.start), dateKey(w.end)]),
      expected,
    );
    for (const week of weeks)
      for (let day = 0; day < 7; day++) {
        const period = fiscalPeriod(addDays(week.start, day));
        assert.equal(period?.year, Number(year));
        assert.equal(period?.week, week.week);
        assert.equal(period?.month, week.month);
      }
  }
  assert.equal(fiscalPeriod(new Date("2027-01-30"))?.year, 2026);
  assert.equal(fiscalPeriod(new Date("2027-01-31"))?.year, 2027);
  assert.equal(fiscalPeriod(new Date("2029-02-03"))?.week, 53);
  assert.equal(fiscalPeriod(new Date("2029-02-04"))?.year, 2029);
  const overlapping = [
    { year: 2029, startDate: new Date("2029-01-28"), weeks: 52 },
  ];
  assert.equal(fiscalPeriod(new Date("2029-01-28"), overlapping)?.year, 2028);
  assert.equal(fiscalPeriod(new Date("2029-02-03"), overlapping)?.week, 53);
});

void test("automation intake requires reporting manager and team, and preserves Windows paths", () => {
  const input = {
    submitterName: "Example requester",
    submitterEmail: "requester@test.invalid",
    managerName: "Reporting Manager",
    department: "Planning & BI",
    title: "Weekly reporting automation",
    description: "Automate the weekly reporting process.",
    projectType: "NEW_PROJECT",
    existingProject: null,
    estimatedHours: "4",
    priority: "MEDIUM",
    sopLocation: String.raw`\\fileserver\team\Process SOP.docx`,
    requiredFilesLocation: String.raw`D:\Reports\Input.xlsx`,
  };
  const parsed = publicRequestSchema.parse(input);
  assert.equal(parsed.managerName, input.managerName);
  assert.equal(parsed.department, input.department);
  assert.equal(parsed.sopLocation, input.sopLocation);
  assert.equal(parsed.requiredFilesLocation, input.requiredFilesLocation);
  assert.equal(
    publicRequestSchema.safeParse({ ...input, managerName: " " }).success,
    false,
  );
  assert.equal(
    publicRequestSchema.safeParse({ ...input, department: " " }).success,
    false,
  );
  assert.equal(
    publicRequestSchema.safeParse({ ...input, sopLocation: "x".repeat(2001) })
      .success,
    false,
  );
});

void test("SOP upload validates content and size, and normalizes client filenames", async () => {
  const upload = await readSopUpload(
    new File(["%PDF-1.7\nExample SOP"], "Process SOP.pdf", {
      type: "text/html",
    }),
  );
  assert.equal(upload?.sopFileName, "Process SOP.pdf");
  assert.equal(upload?.sopFileType, "application/pdf");
  assert.equal(upload?.sopFileData.toString(), "%PDF-1.7\nExample SOP");
  assert.equal(upload?.sopFileSha256.length, 64);
  const text = await readSopUpload(
    new File(["Process steps"], String.raw`C:\fakepath\SOP.txt`),
  );
  assert.equal(text?.sopFileName, "SOP.txt");
  assert.equal(await readSopUpload(new File([], "")), null);
  await assert.rejects(
    readSopUpload(new File(["<script>bad</script>"], "SOP.pdf")),
    /valid PDF/,
  );
  await assert.rejects(
    readSopUpload(new File(["binary\0data"], "SOP.txt")),
    /valid PDF/,
  );
  await assert.rejects(
    readSopUpload(new File([new Uint8Array(MAX_SOP_BYTES + 1)], "SOP.txt")),
    /3 MB/,
  );
  await assert.rejects(
    readSopUpload(new File(["steps"], "bad\r\nname.txt")),
    /filename/,
  );
});

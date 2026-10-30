import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProjectSheet } from "@/lib/project-import";
import { readProjectWorkbook } from "@/lib/project-workbook";
import { workbookFile } from "./helpers/project-workbook";

const headers = [
  "No.",
  "Project",
  "Impact",
  "Status",
  "Time saved (hrs/year)",
  "Type",
  "Recorded enhancement iterations",
  "Enhancement details",
  "Extra reference",
];
const row = [
  "001",
  "Sample automation",
  "Critical",
  "Completed",
  "1,250",
  "Project (Time Saving)",
  "3",
  "1. First change\n\n2. Second change",
  "000042",
];
void test("real XLSX reading detects row-four headers, ignores totals, and preserves original values", async () => {
  const workbook = await readProjectWorkbook(
    workbookFile([
      ["Sample register", "999999"],
      [],
      ["", "1234"],
      headers,
      row,
    ]),
  );
  const project = workbook.rows[0];
  assert.equal(project.row, 5);
  assert.equal(project.status, "COMPLETED");
  assert.equal(project.priority, "CRITICAL");
  assert.equal(project.savedHours, 1250);
  assert.equal(project.key, "001");
  assert.equal(project.changes.length, 3);
  assert.equal(project.changes[0].title, "First change");
  assert.match(project.changes[2].title, /details pending/);
  assert.equal(project.additionalDetails.at(-1)?.value, "000042");
  assert.equal(project.additionalDetails[7].value, row[7]);
});
void test("discovery, enhancement type, blank savings and future team columns map without inventing dates", () => {
  const [project] = parseProjectSheet([
    ["Project", "Status", "Type", "Team", "Sub-team", "Saved hours"],
    [
      "Sample discovery",
      "Discovery",
      "Enhancement",
      "Planning",
      "Operations",
      "",
    ],
  ]);
  assert.equal(project.status, "PLANNING");
  assert.equal(project.projectType, "ENHANCEMENT");
  assert.equal(project.savedHours, undefined);
  assert.equal(project.department, "Planning");
  assert.equal(project.subTeam, "Operations");
  assert.equal("startDate" in project, false);
});
void test("duplicate references, duplicate normalized titles, unnamed values and unknown status are rejected with row context", () => {
  assert.throws(
    () =>
      parseProjectSheet([
        headers,
        row,
        [row[0], "Different sample", ...row.slice(2)],
      ]),
    /Row 3: duplicate project reference/,
  );
  assert.throws(
    () =>
      parseProjectSheet([
        headers,
        row,
        ["002", " SAMPLE AUTOMATION ", ...row.slice(2)],
      ]),
    /duplicate project title/,
  );
  assert.throws(
    () =>
      parseProjectSheet([
        ["Project", "Status", ""],
        ["Sample", "Completed", "lost value"],
      ]),
    /no heading/,
  );
  assert.throws(
    () =>
      parseProjectSheet([
        ["Project", "Status"],
        ["Sample", "Unknown"],
      ]),
    /Row 2: unsupported status/,
  );
});
void test("invalid numbers, too many projects and oversized field values fail before creating a preview", () => {
  assert.throws(
    () =>
      parseProjectSheet([
        headers,
        [...row.slice(0, 4), "not hours", ...row.slice(5)],
      ]),
    /Row 2/,
  );
  assert.throws(
    () =>
      parseProjectSheet([headers, [...row.slice(0, 6), "-2", ...row.slice(7)]]),
    /enhancement count/,
  );
  assert.throws(
    () =>
      parseProjectSheet([
        ["Project", "Status", "Notes"],
        ["Sample", "Completed", "x".repeat(5001)],
      ]),
    /Row 2/,
  );
  assert.throws(
    () =>
      parseProjectSheet([
        ["Project", "Status"],
        ...Array.from({ length: 201 }, (_, i) => [`Sample ${i}`, "Completed"]),
      ]),
    /at most 200/,
  );
});
void test("sparse worksheet coordinates and unsupported file types are rejected before cell parsing", async () => {
  await assert.rejects(
    readProjectWorkbook(
      workbookFile([], {
        sheetXml:
          '<worksheet><sheetData><row r="1048576"><c r="XFD1048576"/></row></sheetData></worksheet>',
      }),
    ),
    /2,000 rows/,
  );
  await assert.rejects(
    readProjectWorkbook(workbookFile([headers, row], { name: "sample.xls" })),
    /\.xlsx/,
  );
  await assert.rejects(
    readProjectWorkbook(
      new File([new Uint8Array(3 * 1024 * 1024 + 1)], "sample.xlsx"),
    ),
    /3 MB/,
  );
});

void test("XML coordinate limits cover single quotes, encoded references and implicit rows", async () => {
  for (const xml of [
    "<worksheet><sheetData><row r='1048576'/></sheetData></worksheet>",
    '<worksheet><sheetData><row r="1"><c r="&#88;FD1048576"/></row></sheetData></worksheet>',
    `<worksheet><sheetData>${"<row/>".repeat(2001)}</sheetData></worksheet>`,
  ])
    await assert.rejects(
      readProjectWorkbook(workbookFile([], { sheetXml: xml })),
      /2,000 rows/,
    );
});
void test("worksheet paths with alternate extensions receive the same coordinate guard", async () => {
  for (const sheetPath of [
    "worksheets/sheet1.XML",
    "alternate/worksheet.dat",
  ]) {
    await assert.rejects(
      readProjectWorkbook(
        workbookFile([], {
          sheetPath,
          sheetXml:
            '<worksheet><sheetData><row r="1048576"/></sheetData></worksheet>',
        }),
      ),
      /2,000 rows/,
    );
  }
});

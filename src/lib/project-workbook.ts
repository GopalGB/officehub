import readExcelFile from "read-excel-file/node";
import { unzipSync, strFromU8 } from "fflate";
import { parseProjectSheet } from "@/lib/project-import";

const MAX_UPLOAD = 3 * 1024 * 1024;

/** Bound ZIP expansion and sparse worksheet coordinates before parsing cells. */
export async function readProjectWorkbook(file: File) {
  if (
    !file.name.toLowerCase().endsWith(".xlsx") ||
    !file.size ||
    file.size > MAX_UPLOAD
  )
    throw new Error("Choose an .xlsx workbook up to 3 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let total = 0,
    files = 0;
  unzipSync(buffer, {
    filter: (entry) => {
      total += entry.originalSize;
      if (
        ++files > 100 ||
        total > 20 * 1024 * 1024 ||
        entry.originalSize > 10 * 1024 * 1024
      )
        throw new Error(
          "Workbook is too large when expanded. Split it into smaller files.",
        );
      return false;
    },
  });
  // fflate 0.8.3 declares generic Uint8Arrays (TS 5.7+); this repo uses TS 5.6.
  const sheets = unzipSync(buffer, {
    filter: (entry) => /^xl\/worksheets\/[^/]+\.xml$/.test(entry.name),
  }) as Record<string, Uint8Array>;
  if (Object.keys(sheets).length > 4)
    throw new Error("Use a workbook with at most four sheets.");
  for (const bytes of Object.values(sheets)) {
    const xml = strFromU8(bytes);
    for (const match of xml.matchAll(/\br="([A-Z]*)(\d+)"/g)) {
      const col = [...match[1]].reduce(
        (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
        0,
      );
      if (col > 52 || Number(match[2]) > 2000)
        throw new Error(
          "Keep project data within 2,000 rows and 52 columns. Remove unused formatted rows or columns.",
        );
    }
  }
  const workbook = await readExcelFile(buffer, {
    trim: false,
    parseNumber: (value) => value,
  });
  const candidates = workbook.filter((sheet) =>
    sheet.data.some((row) =>
      row.some(
        (cell) =>
          typeof cell === "string" &&
          ["project", "project name", "title"].includes(
            cell.trim().toLowerCase(),
          ),
      ),
    ),
  );
  if (candidates.length !== 1)
    throw new Error(
      "Use exactly one project sheet; other sheets may contain reference data.",
    );
  const sheet = candidates[0];
  const rows = sheet.data.map((row) =>
    row.map((cell) =>
      cell === null
        ? ""
        : cell instanceof Date
          ? cell.toISOString().slice(0, 10)
          : String(cell),
    ),
  );
  return { sheetName: sheet.sheet, rows: parseProjectSheet(rows) };
}

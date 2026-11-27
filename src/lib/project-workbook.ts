import readExcelFile from "read-excel-file/universal";
import { unzipSync } from "fflate";
import { SaxesParser } from "saxes";
import { parseProjectSheet } from "@/lib/project-import";

const MAX_UPLOAD = 3 * 1024 * 1024;

export type WorkbookLimits = {
  sheets: number;
  rows: number;
  columns: number;
};
const UPLOAD_LIMITS: WorkbookLimits = { sheets: 4, rows: 2000, columns: 52 };

/** Bound ZIP expansion and sparse worksheet coordinates before parsing cells,
 * then return every sheet as plain strings. Used by uploads and linked files. */
export async function readBoundedWorkbook(
  buffer: Buffer,
  limits: WorkbookLimits = UPLOAD_LIMITS,
) {
  let total = 0,
    files = 0;
  unzipSync(buffer, {
    filter: (entry) => {
      total += entry.originalSize;
      if (
        ++files > 200 ||
        total > 40 * 1024 * 1024 ||
        entry.originalSize > 20 * 1024 * 1024
      )
        throw new Error(
          "Workbook is too large when expanded. Split it into smaller files.",
        );
      return false;
    },
  });
  // fflate 0.8.3 declares generic Uint8Arrays (TS 5.7+); this repo uses TS 5.6.
  const parts = unzipSync(buffer) as Record<string, Uint8Array>;
  let declaredSheets = 0;
  for (const bytes of Object.values(parts)) {
    // Relationships can name XML content with any extension. Inspect its bytes.
    const xml = new TextDecoder().decode(bytes);
    if (!xml.trimStart().startsWith("<")) continue;
    let rowCount = 0,
      cellCount = 0;
    const parser = new SaxesParser({ xmlns: false });
    parser.on("doctype", () => {
      throw new Error(
        "Workbook XML must not contain a document type declaration.",
      );
    });
    parser.on("opentag", (tag) => {
      const name = tag.name.split(":").at(-1);
      if (name === "sheet" && ++declaredSheets > limits.sheets)
        throw new Error(`Use a workbook with at most ${limits.sheets} sheets.`);
      if (name !== "row" && name !== "c") return;
      if (name === "row") rowCount++;
      else cellCount++;
      const reference = tag.attributes.r;
      // SAX decodes entities and handles either quoting style, unlike a text scan.
      const match =
        reference === undefined
          ? null
          : name === "row"
            ? /^(\d+)$/.exec(reference)
            : /^([A-Z]+)(\d+)$/.exec(reference);
      if (reference !== undefined && !match)
        throw new Error("Invalid worksheet row or cell reference.");
      const rowNumber = match ? Number(match.at(-1)) : 1;
      const column =
        name === "c" && match
          ? [...match[1]].reduce(
              (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
              0,
            )
          : 1;
      if (
        rowNumber < 1 ||
        rowNumber > limits.rows ||
        column > limits.columns ||
        rowCount > limits.rows ||
        cellCount > limits.rows * limits.columns
      )
        throw new Error(
          `Keep each sheet within ${limits.rows.toLocaleString("en")} rows and ${limits.columns} columns. Remove unused formatted rows or columns.`,
        );
    });
    parser.write(xml).close();
  }
  // The universal reader uses the same bounded fflate ZIP decoding as preflight.
  // No paths from workbook relationships are read from disk or fetched remotely.
  const workbook = await readExcelFile(new Blob([new Uint8Array(buffer)]), {
    trim: false,
    parseNumber: (value) => value,
  });
  return workbook.map((sheet) => ({
    name: sheet.sheet,
    rows: sheet.data.map((row) =>
      row.map((cell) =>
        cell === null
          ? ""
          : cell instanceof Date
            ? cell.toISOString().slice(0, 10)
            : String(cell),
      ),
    ),
  }));
}

export function findProjectSheet(sheets: { name: string; rows: string[][] }[]) {
  const candidates = sheets.filter((sheet) =>
    sheet.rows.some((row) =>
      row.some((cell) =>
        ["project", "project name", "title"].includes(cell.trim().toLowerCase()),
      ),
    ),
  );
  if (candidates.length !== 1)
    throw new Error(
      "Use exactly one project sheet; other sheets may contain reference data.",
    );
  return candidates[0];
}

export async function readProjectWorkbook(file: File) {
  if (
    !file.name.toLowerCase().endsWith(".xlsx") ||
    !file.size ||
    file.size > MAX_UPLOAD
  )
    throw new Error("Choose an .xlsx workbook up to 3 MB.");
  const sheets = await readBoundedWorkbook(Buffer.from(await file.arrayBuffer()));
  const sheet = findProjectSheet(sheets);
  return { sheetName: sheet.name, rows: parseProjectSheet(sheet.rows) };
}

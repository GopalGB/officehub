import readExcelFile from "read-excel-file/universal";
import { unzipSync, strFromU8 } from "fflate";
import { SaxesParser } from "saxes";
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
  const xmlParts = unzipSync(buffer, {
    filter: (entry) => entry.name.endsWith(".xml"),
  }) as Record<string, Uint8Array>;
  let declaredSheets = 0;
  for (const bytes of Object.values(xmlParts)) {
    const xml = strFromU8(bytes);
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
      if (name === "sheet" && ++declaredSheets > 4)
        throw new Error("Use a workbook with at most four sheets.");
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
        rowNumber > 2000 ||
        column > 52 ||
        rowCount > 2000 ||
        cellCount > 104000
      )
        throw new Error(
          "Keep project data within 2,000 rows and 52 columns. Remove unused formatted rows or columns.",
        );
    });
    parser.write(xml).close();
  }
  // The universal reader uses the same bounded fflate ZIP decoding as preflight.
  // No paths from workbook relationships are read from disk or fetched remotely.
  const workbook = await readExcelFile(file, {
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

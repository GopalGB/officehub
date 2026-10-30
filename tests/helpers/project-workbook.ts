import { zipSync } from "fflate";

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const strToU8 = (value: string) => new TextEncoder().encode(value);
export function workbookFile(
  rows: string[][],
  options: { sheetXml?: string; name?: string; sheetPath?: string } = {},
) {
  const sheetXml =
    options.sheetXml ??
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, index) => `<row r="${index + 1}">${row.map((value, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const buffer = zipSync({
    "[Content_Types].xml": strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
    ),
    "xl/workbook.xml": strToU8(
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Projects" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${xml(options.sheetPath ?? "worksheets/sheet1.xml")}"/></Relationships>`,
    ),
    ["xl/" + (options.sheetPath ?? "worksheets/sheet1.xml")]: strToU8(sheetXml),
  }) as Uint8Array; // Compatibility with fflate's TS 5.7+ generic typed arrays.
  return new File([new Uint8Array(buffer)], options.name ?? "sample.xlsx");
}

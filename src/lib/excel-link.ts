import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { readBoundedWorkbook } from "@/lib/project-workbook";
import { importName, parseProjectSheet } from "@/lib/project-import";
import {
  prepareProjectImport,
  applyProjectImport,
} from "@/lib/project-import-service";
import { isManagerOrAbove } from "@/lib/rbac";

const LINK_LIMITS = { sheets: 20, rows: 5000, columns: 60 };
const MAX_DOWNLOAD = 15 * 1024 * 1024;
const SNAPSHOT_ROWS = 5000;

export const SHEET_PURPOSES = [
  { value: "PROJECTS", label: "Projects", detail: "Creates and updates projects (with history)." },
  { value: "LEAVES", label: "Leaves", detail: "Feeds the team leave calendar and the help pool." },
  { value: "TABLE", label: "View only", detail: "Shown as a table inside OfficeHub." },
  { value: "IGNORE", label: "Ignore", detail: "Not read or shown." },
] as const;
export const SheetPurposeEnum = z.enum(["PROJECTS", "LEAVES", "TABLE", "IGNORE"]);
export type SheetPurpose = z.infer<typeof SheetPurposeEnum>;

export const LEAVE_FIELDS = {
  person: ["name", "employee", "employee name", "person", "team member", "member", "resource", "associate"],
  email: ["email", "e-mail", "mail", "email id"],
  start: ["from", "start", "start date", "from date", "leave from", "date", "leave date"],
  end: ["to", "end", "end date", "to date", "leave to", "till", "until"],
  type: ["type", "leave type", "reason", "category"],
  note: ["note", "notes", "comment", "comments", "remarks"],
} as const;
export type LeaveField = keyof typeof LEAVE_FIELDS;

export type SheetInfo = {
  name: string;
  headers: string[];
  headerRow: number;
  rowCount: number;
  purpose: SheetPurpose;
  reason: string;
  columns: Partial<Record<LeaveField, string>>;
};

export const mappingsSchema = z.record(
  z.string().max(200),
  z.object({
    purpose: SheetPurposeEnum,
    columns: z.record(z.string().max(40), z.string().max(200)).default({}),
  }),
);
export type Mappings = z.infer<typeof mappingsSchema>;

/** Only Microsoft share hosts (plus explicit EXCEL_LINK_HOSTS) are fetched,
 * re-checked on every redirect so a link cannot reach internal addresses. */
export function allowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  const extra = (process.env.EXCEL_LINK_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return (
    host.endsWith(".sharepoint.com") ||
    host === "onedrive.live.com" ||
    host === "1drv.ms" ||
    host.endsWith(".files.1drv.com") ||
    host.endsWith(".livefilestore.com") ||
    extra.includes(host)
  );
}

/** SharePoint/OneDrive viewer links open Excel Online; download=1 returns the file. */
export function downloadUrl(link: string) {
  const url = new URL(link);
  if (url.protocol !== "https:") throw new Error("Use the https share link.");
  if (!allowedHost(url.hostname))
    throw new Error(
      "Paste a SharePoint or OneDrive share link (for example https://yourcompany.sharepoint.com/...).",
    );
  if (url.hostname.endsWith(".sharepoint.com") || url.hostname === "onedrive.live.com") {
    url.searchParams.delete("web");
    url.searchParams.set("download", "1");
  }
  return url.toString();
}

export async function fetchWorkbook(link: string): Promise<Buffer> {
  let current = downloadUrl(link);
  for (let hop = 0; hop < 6; hop++) {
    const target = new URL(current);
    if (target.protocol !== "https:" || !allowedHost(target.hostname))
      throw new Error("The share link redirected somewhere unexpected. Check the link and sharing settings.");
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
      headers: { accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*" },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) break;
      current = new URL(next, current).toString();
      continue;
    }
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "SharePoint refused the link. Share the file as “Anyone with the link can view”, or ask IT to allow it.",
      );
    if (!response.ok)
      throw new Error(`SharePoint returned ${response.status}. Check that the link still works.`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_DOWNLOAD) throw new Error("The workbook is larger than 15 MB.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("SharePoint returned an empty response.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DOWNLOAD) {
        await reader.cancel();
        throw new Error("The workbook is larger than 15 MB.");
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    // xlsx files are ZIP archives; anything else is usually a sign-in page.
    if (buffer.subarray(0, 2).toString("latin1") !== "PK")
      throw new Error(
        "The link opened a web page instead of the file. Use a share link set to “Anyone with the link can view”.",
      );
    return buffer;
  }
  throw new Error("Too many redirects while opening the share link.");
}

function findHeaderRow(rows: string[][]) {
  const index = rows
    .slice(0, 15)
    .findIndex((row) => row.filter((cell) => cell.trim()).length >= 2);
  return index < 0 ? 0 : index;
}

function matchColumn(headers: string[], names: readonly string[]) {
  const normalized = headers.map(importName);
  for (const name of names) {
    const i = normalized.indexOf(name);
    if (i >= 0) return headers[i];
  }
  return undefined;
}

export function leaveColumns(headers: string[]) {
  const columns: Partial<Record<LeaveField, string>> = {};
  for (const field of Object.keys(LEAVE_FIELDS) as LeaveField[]) {
    const found = matchColumn(headers, LEAVE_FIELDS[field]);
    if (found) columns[field] = found;
  }
  return columns;
}

/** Explain each sheet: what it looks like and what OfficeHub will make of it. */
export function analyzeSheet(name: string, rows: string[][]): SheetInfo {
  const headerRow = findHeaderRow(rows);
  const headers = (rows[headerRow] ?? []).map((h) => h.trim());
  const body = rows.slice(headerRow + 1).filter((row) => row.some((c) => c.trim()));
  const leave = leaveColumns(headers);
  const lowerName = importName(name);
  let purpose: SheetPurpose = "TABLE";
  let reason = "No known layout found, so it will be shown as a table.";
  let projectReady = false;
  try {
    projectReady = parseProjectSheet(rows).length > 0;
  } catch {
    projectReady = false;
  }
  if ((leave.person || leave.email) && leave.start && (lowerName.includes("leave") || leave.end || leave.type)) {
    purpose = "LEAVES";
    reason = `Looks like a leave tracker (person: “${leave.person ?? leave.email}”, from: “${leave.start}”${leave.end ? `, to: “${leave.end}”` : ""}).`;
  } else if (projectReady) {
    purpose = "PROJECTS";
    reason = "Has project title and status/priority columns, so rows can become projects.";
  } else if (!headers.some(Boolean)) {
    purpose = "IGNORE";
    reason = "The sheet is empty.";
  }
  return { name, headers, headerRow, rowCount: body.length, purpose, reason, columns: purpose === "LEAVES" ? leave : {} };
}

function parseDateCell(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d\d-\d\d/.test(v)) return v.slice(0, 10);
  // Excel serial dates (days since 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const ms = Date.UTC(1899, 11, 30) + Number(v) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    // Offices using this tracker write day/month/year.
    const d = new Date(Date.UTC(year, Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

type SyncActor = { id: string; role: Role; name?: string | null; active: boolean };

async function syncLeaves(
  linkId: string,
  sheet: string,
  rows: string[][],
  info: SheetInfo,
  columns: Record<string, string>,
) {
  const at = (field: LeaveField) => {
    const header = columns[field] ?? info.columns[field];
    return header ? info.headers.indexOf(header) : -1;
  };
  const idx = { person: at("person"), email: at("email"), start: at("start"), end: at("end"), type: at("type"), note: at("note") };
  if ((idx.person < 0 && idx.email < 0) || idx.start < 0)
    throw new Error(`Sheet “${sheet}”: choose the person and start-date columns.`);
  const users = await db.user.findMany({ select: { id: true, name: true, email: true } });
  const byName = new Map(users.map((u) => [importName(u.name), u.id]));
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const prefix = `excel:${linkId}:${importName(sheet)}:`;
  const seen: string[] = [];
  let skipped = 0;
  const records: Prisma.LeaveCreateManyInput[] = [];
  for (const row of rows.slice(info.headerRow + 1)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const person = cell(idx.person) || cell(idx.email);
    const start = parseDateCell(cell(idx.start));
    const end = parseDateCell(cell(idx.end)) ?? start;
    if (!person || !start || !end) {
      if (row.some((c) => c.trim())) skipped++;
      continue;
    }
    const [from, to] = start <= end ? [start, end] : [end, start];
    const key = prefix + createHash("sha256").update(`${importName(person)}|${from}|${to}`).digest("hex").slice(0, 32);
    if (seen.includes(key)) continue;
    seen.push(key);
    records.push({
      sourceKey: key,
      source: "EXCEL",
      personName: person.slice(0, 120),
      userId: byEmail.get(cell(idx.email).toLowerCase()) ?? byName.get(importName(person)) ?? null,
      startDate: new Date(from),
      endDate: new Date(to),
      type: (cell(idx.type) || "Leave").slice(0, 40),
      note: cell(idx.note).slice(0, 300) || null,
    });
  }
  await db.$transaction(async (tx) => {
    await tx.leave.deleteMany({ where: { sourceKey: { startsWith: prefix } } });
    if (records.length) await tx.leave.createMany({ data: records, skipDuplicates: true });
  });
  return { leaves: records.length, skipped };
}

/** Read the workbook, refresh sheet snapshots, and apply mapped purposes. */
export async function syncExcelLink(linkId: string, actor?: SyncActor) {
  const link = await db.excelLink.findUniqueOrThrow({
    where: { id: linkId },
    include: { owner: { select: { id: true, role: true, name: true, active: true } } },
  });
  const runAs = actor ?? link.owner;
  try {
    const buffer = await fetchWorkbook(link.url);
    const hash = createHash("sha256").update(buffer).digest("hex");
    // Unchanged file and mappings: nothing to apply.
    if (hash === link.lastHash && !actor) {
      await db.excelLink.update({ where: { id: linkId }, data: { lastSyncedAt: new Date(), lastError: null } });
      return { ok: true as const, unchanged: true };
    }
    const sheets = await readBoundedWorkbook(buffer, LINK_LIMITS);
    const infos = sheets.map((s) => analyzeSheet(s.name, s.rows));
    const saved = mappingsSchema.catch({}).parse(link.mappings);
    const result: { sheet: string; purpose: SheetPurpose; summary: string }[] = [];
    for (const sheet of sheets) {
      const info = infos.find((i) => i.name === sheet.name)!;
      // Unconfirmed sheets are only shown; importing needs a manager's choice.
      const mapping = saved[sheet.name] ?? {
        purpose: info.purpose === "IGNORE" ? "IGNORE" : "TABLE",
        columns: {},
      };
      if (mapping.purpose === "IGNORE") {
        await db.excelSheetSnapshot.deleteMany({ where: { linkId, sheetName: sheet.name } });
        result.push({ sheet: sheet.name, purpose: "IGNORE", summary: "Ignored" });
        continue;
      }
      const body = sheet.rows.slice(info.headerRow + 1).filter((r) => r.some((c) => c.trim())).slice(0, SNAPSHOT_ROWS);
      await db.excelSheetSnapshot.upsert({
        where: { linkId_sheetName: { linkId, sheetName: sheet.name } },
        create: { linkId, sheetName: sheet.name, headers: info.headers, rows: body },
        update: { headers: info.headers, rows: body },
      });
      if (mapping.purpose === "LEAVES") {
        const r = await syncLeaves(linkId, sheet.name, sheet.rows, info, mapping.columns);
        result.push({ sheet: sheet.name, purpose: "LEAVES", summary: `${r.leaves} leaves synced${r.skipped ? `, ${r.skipped} rows skipped (missing name or date)` : ""}` });
      } else if (mapping.purpose === "PROJECTS") {
        if (!runAs.active || !isManagerOrAbove(runAs.role)) {
          result.push({ sheet: sheet.name, purpose: "PROJECTS", summary: "Skipped: the link owner must be an active manager to update projects" });
          continue;
        }
        const rows = parseProjectSheet(sheet.rows);
        const preview = await prepareProjectImport(runAs, { ownerId: link.ownerId, source: `Excel link ${link.name}`.slice(0, 100) }, { fileName: link.name, sheetName: sheet.name, rows });
        const applied = await applyProjectImport(runAs, preview.id, true);
        result.push({
          sheet: sheet.name,
          purpose: "PROJECTS",
          summary: `${applied.created} created, ${applied.updated} updated, ${applied.skipped} unchanged or skipped`,
        });
      } else {
        result.push({ sheet: sheet.name, purpose: "TABLE", summary: `${body.length} rows available to view` });
      }
    }
    // Drop snapshots for sheets that no longer exist.
    await db.excelSheetSnapshot.deleteMany({ where: { linkId, sheetName: { notIn: sheets.map((s) => s.name) } } });
    await db.excelLink.update({
      where: { id: linkId },
      data: { sheets: infos, lastSyncedAt: new Date(), lastHash: hash, lastError: null, lastResult: result },
    });
    return { ok: true as const, sheets: infos, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the workbook.";
    await db.excelLink.update({ where: { id: linkId }, data: { lastError: message.slice(0, 500), lastSyncedAt: new Date() } });
    return { ok: false as const, error: message };
  }
}

/** Called on a timer from instrumentation: sync links whose interval elapsed. */
export async function syncDueExcelLinks(now = new Date()) {
  const links = await db.excelLink.findMany({
    where: { autoSync: true },
    select: { id: true, intervalMin: true, lastSyncedAt: true },
  });
  for (const link of links) {
    if (link.lastSyncedAt && now.getTime() - link.lastSyncedAt.getTime() < link.intervalMin * 60_000) continue;
    await syncExcelLink(link.id);
  }
}

/** Owner, admins, everyone when shared with all, or the chosen viewers. */
export function excelLinkAccessWhere(viewer: { id: string; role: Role }): Prisma.ExcelLinkWhereInput {
  if (viewer.role === "ADMIN") return {};
  return {
    OR: [{ ownerId: viewer.id }, { shareWithAll: true }, { viewers: { some: { id: viewer.id } } }],
  };
}

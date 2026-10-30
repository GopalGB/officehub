import { z } from "zod";
import { additionalDetailsSchema } from "@/lib/additional-details";
import {
  PriorityEnum,
  ProjectStatusEnum,
  projectTypeEnum,
} from "@/lib/validation";

export const IMPORT_LIMIT = 200;
export const importOptionsSchema = z.object({
  ownerId: z.string().cuid(),
  source: z.string().trim().min(1).max(100),
});
export const importCommitSchema = z.object({
  importId: z.string().cuid(),
  updateExisting: z.boolean(),
});
export const importRowSchema = z.object({
  row: z.number().int().positive(),
  key: z.string().min(1).max(200),
  title: z.string().trim().min(2).max(160),
  status: ProjectStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  projectType: projectTypeEnum.optional(),
  savedHours: z.number().finite().min(0).max(100000).optional(),
  department: z.string().trim().max(100).optional(),
  subTeam: z.string().trim().max(100).optional(),
  additionalDetails: additionalDetailsSchema,
  changes: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        description: z.string().max(2000),
      }),
    )
    .max(50),
});
export type ImportRow = z.infer<typeof importRowSchema>;
export const stagedRowSchema = z.object({
  data: importRowSchema,
  hash: z.string(),
  projectId: z.string().nullable(),
  expectedVersion: z.number().int().nullable(),
  recordId: z.string().nullable(),
  disposition: z.enum(["create", "update", "unchanged", "conflict"]),
  note: z.string(),
});
export const stagedRowsSchema = z
  .array(stagedRowSchema)
  .min(1)
  .max(IMPORT_LIMIT);
export type StagedRow = z.infer<typeof stagedRowSchema>;
export type ImportPreview = {
  id: string;
  ownerId: string;
  fileName: string;
  sheetName: string;
  rows: StagedRow[];
  savedHours: number;
  changes: number;
};
export const importResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skipped: z.number().int(),
  changesAdded: z.number().int(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export function importName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

const aliases = {
  title: ["project", "project name", "title"],
  key: ["no.", "no", "project id", "id", "reference"],
  priority: ["impact", "priority"],
  status: ["status"],
  type: ["type", "project type"],
  savedHours: ["time saved (hrs/year)", "annual hours saved", "saved hours"],
  count: ["recorded enhancement iterations", "enhancement count"],
  details: ["enhancement details"],
  team: ["team", "department"],
  subTeam: ["sub-team", "sub team", "subteam"],
} as const;

/** Header detection deliberately ignores workbook titles and summary totals. */
export function parseProjectSheet(rows: string[][]): ImportRow[] {
  const headerAt = rows
    .slice(0, 20)
    .findIndex(
      (row) =>
        row.some((cell) =>
          (aliases.title as readonly string[]).includes(importName(cell)),
        ) &&
        row.some((cell) =>
          ["status", "impact", "priority", "type", "project type"].includes(
            importName(cell),
          ),
        ),
    );
  if (headerAt < 0)
    throw new Error(
      "Use a Project column and a Status, Impact, Priority, or Type column in the first 20 rows.",
    );
  const headers = rows[headerAt].map((cell) => cell.trim());
  const keys = headers.filter(Boolean).map(importName);
  if (new Set(keys).size !== keys.length)
    throw new Error("Column names must be unique.");
  if (keys.length > 50) throw new Error("Use at most 50 named columns.");
  const column = (name: keyof typeof aliases) =>
    headers.findIndex((header) =>
      (aliases[name] as readonly string[]).includes(importName(header)),
    );
  const seen = new Set<string>();
  const titles = new Set<string>();
  const result: ImportRow[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every((cell) => !cell.trim())) continue;
    if (cells.some((cell, index) => cell.trim() && !headers[index]))
      throw new Error(`Row ${i + 1}: a populated column has no heading.`);
    const get = (name: keyof typeof aliases) =>
      cells[column(name)]?.trim() ?? "";
    const title = get("title");
    if (!title) throw new Error(`Row ${i + 1}: project title is missing.`);
    if (titles.has(importName(title)))
      throw new Error(
        `Row ${i + 1}: duplicate project title. Give each project a distinct name.`,
      );
    titles.add(importName(title));
    const key = importName(get("key") || title);
    if (seen.has(key))
      throw new Error(`Row ${i + 1}: duplicate project reference ${key}.`);
    seen.add(key);
    const rawStatus = get("status"),
      rawPriority = get("priority"),
      rawType = get("type");
    const statuses: Record<string, z.infer<typeof ProjectStatusEnum>> = {
      discovery: "PLANNING",
      planning: "PLANNING",
      "in progress": "IN_PROGRESS",
      active: "IN_PROGRESS",
      completed: "COMPLETED",
      done: "COMPLETED",
      blocked: "BLOCKED",
      "on hold": "ON_HOLD",
      archived: "ARCHIVED",
    };
    const status = rawStatus
      ? statuses[importName(rawStatus).replaceAll("_", " ")]
      : undefined;
    if (rawStatus && !status)
      throw new Error(`Row ${i + 1}: unsupported status “${rawStatus}”.`);
    const priority = rawPriority
      ? PriorityEnum.safeParse(rawPriority.toUpperCase())
      : null;
    if (priority && !priority.success)
      throw new Error(
        `Row ${i + 1}: impact must be Low, Medium, High, or Critical.`,
      );
    let count = Number(get("count") || 0);
    if (!Number.isSafeInteger(count) || count < 0 || count > 50)
      throw new Error(
        `Row ${i + 1}: enhancement count must be between 0 and 50.`,
      );
    const notes = (cells[column("details")] ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^\d+\s*[.)]\s*/, ""))
      .filter(Boolean);
    count = Math.max(count, notes.length);
    const changes = Array.from({ length: count }, (_, index) => {
      const detail = notes[index];
      return detail
        ? { title: detail.slice(0, 160), description: detail }
        : {
            title: `Recorded enhancement ${index + 1} — details pending`,
            description:
              "The spreadsheet records this iteration but does not supply its details or dates. Add them when available.",
          };
    });
    const hours = get("savedHours");
    const parsed = importRowSchema.safeParse({
      row: i + 1,
      key,
      title,
      status,
      priority: priority?.success ? priority.data : undefined,
      projectType: rawType
        ? importName(rawType).startsWith("enhancement")
          ? "ENHANCEMENT"
          : importName(rawType) === "support"
            ? "SUPPORT"
            : "NEW_PROJECT"
        : undefined,
      ...(hours && { savedHours: Number(hours.replaceAll(",", "")) }),
      ...(get("team") && { department: get("team") }),
      ...(get("subTeam") && { subTeam: get("subTeam") }),
      additionalDetails: headers.flatMap((label, index) =>
        label ? [{ label, value: cells[index] ?? "" }] : [],
      ),
      changes,
    });
    if (!parsed.success)
      throw new Error(
        `Row ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid values"}`,
      );
    result.push(parsed.data);
    if (result.length > IMPORT_LIMIT)
      throw new Error(`Import at most ${IMPORT_LIMIT} projects at a time.`);
  }
  if (!result.length)
    throw new Error("No project rows found below the header.");
  return result;
}

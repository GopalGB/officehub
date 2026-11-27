import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { dayKey } from "@/lib/schedule-metrics";

type Actor = { id: string; name?: string | null };
export type ScheduleReasonInput = { reasonCategory?: string | null; note?: string | null };

type Dates = { startDate: Date | null; targetDate: Date | null };

/** Rows for every start/target change between two states of a project. */
export async function recordProjectDateChanges(
  tx: Prisma.TransactionClient,
  actor: Actor,
  projectId: string,
  version: number,
  before: Dates,
  after: Dates,
  source: string,
  reason?: ScheduleReasonInput,
) {
  const rows: Prisma.ScheduleChangeCreateManyInput[] = [];
  for (const [field, from, to] of [
    ["START", before.startDate, after.startDate],
    ["TARGET", before.targetDate, after.targetDate],
  ] as const) {
    if (dayKey(from) === dayKey(to)) continue;
    rows.push({
      projectId,
      field,
      fromDate: from,
      toDate: to,
      // A first date is the baseline, not a reschedule: no reason applies.
      reasonCategory: from ? (reason?.reasonCategory ?? null) : null,
      note: from ? (reason?.note ?? null) : null,
      source,
      authorId: actor.id,
      authorName: actor.name ?? "Someone",
      projectVersion: version,
    });
  }
  if (rows.length) await tx.scheduleChange.createMany({ data: rows, skipDuplicates: true });
}

export async function recordEnhancementDateChanges(
  tx: Prisma.TransactionClient,
  actor: Actor,
  projectId: string,
  enhancementId: string,
  before: Dates,
  after: Dates,
  reason?: ScheduleReasonInput,
) {
  const rows: Prisma.ScheduleChangeCreateManyInput[] = [];
  for (const [field, from, to] of [
    ["START", before.startDate, after.startDate],
    ["TARGET", before.targetDate, after.targetDate],
  ] as const) {
    if (dayKey(from) === dayKey(to)) continue;
    rows.push({
      projectId,
      enhancementId,
      field,
      fromDate: from,
      toDate: to,
      reasonCategory: from ? (reason?.reasonCategory ?? null) : null,
      note: from ? (reason?.note ?? null) : null,
      source: "Enhancement dates changed",
      authorId: actor.id,
      authorName: actor.name ?? "Someone",
    });
  }
  if (rows.length) await tx.scheduleChange.createMany({ data: rows });
}

/** True when the edit moves an existing date to a different day. */
export function movesExistingDate(before: Date | null, next: string | Date | null | undefined) {
  if (next === undefined || !before) return false;
  return dayKey(before) !== dayKey(next);
}

const snapshotDates = z.object({
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

/** Rebuild date history for edits made before ScheduleChange existed. Safe to
 * run repeatedly: rows are keyed by project, version and field. */
export async function backfillScheduleChanges() {
  const projects = await db.project.findMany({ select: { id: true } });
  let created = 0;
  for (const { id } of projects) {
    const revisions = await db.projectRevision.findMany({
      where: { projectId: id },
      orderBy: { version: "asc" },
      select: { version: true, authorId: true, authorName: true, reason: true, createdAt: true, snapshot: true },
    });
    const rows: Prisma.ScheduleChangeCreateManyInput[] = [];
    let previous: { start: string | null; target: string | null } | null = null;
    for (const r of revisions) {
      const parsed = snapshotDates.safeParse(r.snapshot);
      if (!parsed.success) continue;
      const current = { start: dayKey(parsed.data.startDate ?? null), target: dayKey(parsed.data.targetDate ?? null) };
      if (previous) {
        for (const [field, from, to] of [
          ["START", previous.start, current.start],
          ["TARGET", previous.target, current.target],
        ] as const) {
          if (from === to) continue;
          rows.push({
            projectId: id,
            field,
            fromDate: from ? new Date(from) : null,
            toDate: to ? new Date(to) : null,
            source: r.reason,
            authorId: r.authorId,
            authorName: r.authorName,
            projectVersion: r.version,
            createdAt: r.createdAt,
          });
        }
      }
      previous = current;
    }
    if (rows.length) created += (await db.scheduleChange.createMany({ data: rows, skipDuplicates: true })).count;
  }
  return created;
}

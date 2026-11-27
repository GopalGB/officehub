import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { scheduleSummary, type ScheduleSummary } from "@/lib/schedule-metrics";

export type ScheduleRow = {
  id: string;
  title: string;
  status: string;
  ownerName: string;
  brand: string | null;
  team: string | null;
  startDate: Date | null;
  summary: ScheduleSummary;
  enhancements: { id: string; title: string; status: string; startDate: Date | null; targetDate: Date | null; completedAt: Date | null }[];
  reasons: { reason: string | null; count: number }[];
};

/** Projects with their schedule history and metrics for the given (already
 * access-scoped) filter. */
export async function loadSchedules(where: Prisma.ProjectWhereInput, take = 300): Promise<ScheduleRow[]> {
  const projects = await db.project.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      targetDate: true,
      actualEndDate: true,
      department: true,
      owner: { select: { name: true } },
      brand: { select: { name: true } },
      enhancements: {
        select: { id: true, title: true, status: true, startDate: true, targetDate: true, completedAt: true },
        orderBy: { createdAt: "asc" },
      },
      scheduleChanges: {
        select: { field: true, fromDate: true, toDate: true, enhancementId: true, createdAt: true, reasonCategory: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { title: "asc" }],
    take,
  });
  return projects.map((p) => {
    const moves = p.scheduleChanges.filter((c) => c.field === "TARGET" && !c.enhancementId && c.fromDate);
    const counts = new Map<string | null, number>();
    for (const m of moves) counts.set(m.reasonCategory, (counts.get(m.reasonCategory) ?? 0) + 1);
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      ownerName: p.owner.name,
      brand: p.brand?.name ?? null,
      team: p.department,
      startDate: p.startDate,
      summary: scheduleSummary({
        targetDate: p.targetDate,
        actualEndDate: p.actualEndDate,
        status: p.status,
        changes: p.scheduleChanges,
        enhancements: p.enhancements,
      }),
      enhancements: p.enhancements,
      reasons: [...counts.entries()].map(([reason, count]) => ({ reason, count })),
    };
  });
}

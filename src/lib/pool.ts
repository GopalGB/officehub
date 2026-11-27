import type { Prisma } from "@prisma/client";
import { assignablePeopleWhere } from "@/lib/project-people";
import { weekStart, localToday } from "@/lib/fiscal";

export type Availability = {
  id: string;
  name: string;
  team: string | null;
  onLeave: boolean;
  openReports: number;
  activeProjects: number;
  focusBlocks: number;
  load: number;
};

/** Rank assignable people by current workload so "whoever is free" is a
 * transparent, repeatable choice: people on leave today are excluded, then the
 * lowest load wins (active projects count double), ties broken by name. */
export async function teamAvailability(
  client: Pick<Prisma.TransactionClient, "user" | "leave">,
  today = localToday(),
): Promise<Availability[]> {
  const week = weekStart(today);
  const people = await client.user.findMany({
    where: assignablePeopleWhere,
    select: {
      id: true,
      name: true,
      team: true,
      assignedTasks: { where: { status: { not: "DONE" } }, select: { id: true } },
      ownedProjects: { where: { status: { in: ["PLANNING", "IN_PROGRESS", "BLOCKED"] } }, select: { id: true } },
      coOwnedProjects: { where: { status: { in: ["PLANNING", "IN_PROGRESS", "BLOCKED"] } }, select: { id: true } },
      memberProjects: { where: { status: { in: ["PLANNING", "IN_PROGRESS", "BLOCKED"] } }, select: { id: true } },
      workPlans: { where: { weekStart: week }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  const leaves = await client.leave.findMany({
    where: { startDate: { lte: today }, endDate: { gte: today } },
    select: { userId: true, personName: true },
  });
  const onLeave = new Set(leaves.map((l) => l.userId).filter(Boolean));
  const onLeaveNames = new Set(leaves.map((l) => l.personName.trim().toLowerCase()));
  return people
    .map((p) => {
      const projects = new Set([
        ...p.ownedProjects.map((x) => x.id),
        ...p.coOwnedProjects.map((x) => x.id),
        ...p.memberProjects.map((x) => x.id),
      ]).size;
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        onLeave: onLeave.has(p.id) || onLeaveNames.has(p.name.trim().toLowerCase()),
        openReports: p.assignedTasks.length,
        activeProjects: projects,
        focusBlocks: p.workPlans.length,
        load: p.assignedTasks.length + projects * 2,
      };
    })
    .sort((a, b) => Number(a.onLeave) - Number(b.onLeave) || a.load - b.load || a.name.localeCompare(b.name));
}

export function pickFree(people: Availability[], exclude: string[] = []) {
  return people.find((p) => !p.onLeave && !exclude.includes(p.id)) ?? null;
}

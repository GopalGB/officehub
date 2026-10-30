import type { ProjectStatus } from "@prisma/client";

type SummaryProject = {
  id: string;
  status: ProjectStatus;
  targetDate: Date | null;
  ownerId: string;
  coOwnerId: string | null;
  members: { id: string }[];
};
export function summarizePeopleProjects(
  people: { id: string; name: string }[],
  projects: SummaryProject[],
  today: Date,
) {
  const summary = new Map(
    people.map((person) => [
      person.id,
      {
        ...person,
        total: 0,
        completed: 0,
        remaining: 0,
        planning: 0,
        inProgress: 0,
        blocked: 0,
        onHold: 0,
        overdue: 0,
      },
    ]),
  );
  for (const project of projects) {
    if (project.status === "ARCHIVED") continue;
    const assigned = new Set([
      project.ownerId,
      project.coOwnerId,
      ...project.members.map((person) => person.id),
    ]);
    for (const id of assigned) {
      if (!id) continue;
      const person = summary.get(id);
      if (!person) continue;
      person.total++;
      if (project.status === "COMPLETED") person.completed++;
      else {
        person.remaining++;
        if (project.targetDate && project.targetDate < today) person.overdue++;
      }
      if (project.status === "PLANNING") person.planning++;
      if (project.status === "IN_PROGRESS") person.inProgress++;
      if (project.status === "BLOCKED") person.blocked++;
      if (project.status === "ON_HOLD") person.onHold++;
    }
  }
  return [...summary.values()];
}

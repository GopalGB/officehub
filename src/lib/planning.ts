import type { WorkPlan, DailyOverride } from "@prisma/client";
import { dateKey, addDays } from "@/lib/fiscal";
export type PlanWithDays = WorkPlan & { overrides: DailyOverride[] };
export function plannedDay(plan: PlanWithDays, date: Date) {
  if (
    date < plan.weekStart ||
    date >= addDays(plan.weekStart, 7) ||
    !plan.weekdays.includes(date.getUTCDay())
  )
    return null;
  const override = plan.overrides.find(
    (o) => dateKey(o.date) === dateKey(date),
  );
  return {
    planId: plan.id,
    projectId: override?.projectId ?? plan.projectId,
    title: override?.title ?? plan.title,
    hours: override?.hours ?? plan.hours,
    startTime: override?.startTime ?? plan.startTime,
    skipped: override?.skipped ?? false,
    note: override?.note ?? null,
    adjusted: !!override,
    override,
  };
}
export function dayLoad(plans: PlanWithDays[], date: Date) {
  const entries = plans
    .map((p) => plannedDay(p, date))
    .filter((p): p is NonNullable<typeof p> => !!p && !p.skipped);
  const minutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  const overlap = entries.some((a, index) =>
    entries
      .slice(index + 1)
      .some(
        (b) =>
          minutes(a.startTime) < minutes(b.startTime) + b.hours * 60 &&
          minutes(b.startTime) < minutes(a.startTime) + a.hours * 60,
      ),
  );
  return {
    hours: entries.reduce((sum, p) => sum + p.hours, 0),
    overlap,
    entries: entries.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  };
}

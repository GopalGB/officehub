import Link from "next/link";
import { db } from "@/lib/db";
import { weekStart, dateKey, localToday, fiscalLabel } from "@/lib/fiscal";
import { dayLoad } from "@/lib/planning";
import { projectAccessWhere, type Viewer } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
export async function TodayFocus({ viewer }: { viewer: Viewer }) {
  const day = localToday();
  const [plans, projects, configs] = await Promise.all([
    db.workPlan.findMany({
      where: {
        userId: viewer.id,
        weekStart: weekStart(day),
        project: projectAccessWhere(viewer),
      },
      include: { overrides: true },
    }),
    db.project.findMany({
      where: projectAccessWhere(viewer),
      select: { id: true, title: true },
    }),
    db.fiscalYearConfig.findMany(),
  ]);
  const load = dayLoad(plans, day),
    names = Object.fromEntries(projects.map((p) => [p.id, p.title]));
  return (
    <section className="surface border-t-4 border-t-brand-orange">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Today / {fiscalLabel(day, configs)}</p>
          <h2 className="text-xl font-semibold">Your focus today</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {load.hours
              ? `${load.hours} hours planned across ${load.entries.length} focus blocks.`
              : "Make room for your most important project work."}
            {load.overlap ? " Some blocks overlap." : ""}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/planner">Plan my week →</Link>
        </Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {load.entries.map((entry) => (
          <Link
            key={entry.planId}
            href={`/dashboard/planner?day=${dateKey(day)}`}
            className="rounded-lg border bg-secondary/50 p-4 hover:border-brand-orange"
          >
            <p className="text-[11px] font-semibold text-muted-foreground">
              {entry.startTime} · {entry.hours}h
              {entry.adjusted ? " · Adjusted today" : ""}
            </p>
            <h3 className="mt-2 text-sm font-semibold">{entry.title}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {names[entry.projectId] ?? "Project unavailable"}
            </p>
          </Link>
        ))}
      </div>
      {!load.entries.length && (
        <Link
          className="text-link mt-2 inline-block text-sm"
          href="/dashboard/planner"
        >
          Add your first weekly focus block
        </Link>
      )}
    </section>
  );
}

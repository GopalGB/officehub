import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { projectBoardFilters } from "@/lib/project-board";
import { assignablePeopleWhere } from "@/lib/project-people";
import { loadSchedules } from "@/lib/schedule-data";
import { toGanttRow, ganttRange } from "@/lib/gantt";
import { reasonLabel, dayKey } from "@/lib/schedule-metrics";
import { localToday } from "@/lib/fiscal";
import { ScheduleGantt } from "@/components/project/ScheduleGantt";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const STATE_FILTERS = [
  { value: "ALL", label: "All schedules" },
  { value: "SLIPPED", label: "Delayed only" },
  { value: "ACTIVE", label: "Not yet delivered" },
  { value: "DONE", label: "Delivered" },
  { value: "EXTENDED", label: "Extended by enhancements" },
];

/** Portfolio timeline: every visible project's plan against its original target. */
export default async function ProjectTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; owner?: string; brand?: string; team?: string; state?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const manager = isManagerOrAbove(session.user.role);
  const { scope, owner, where } = projectBoardFilters(session.user, { scope: params.scope, owner: params.owner });
  const brand = params.brand && params.brand !== "ALL" ? params.brand : null;
  const team = params.team && params.team !== "ALL" ? params.team.slice(0, 100) : null;
  const state = STATE_FILTERS.some((s) => s.value === params.state) ? params.state! : "ALL";
  const scoped: Prisma.ProjectWhereInput = {
    AND: [where, ...(brand ? [{ brandId: brand }] : []), ...(team ? [{ department: team }] : [])],
  };
  const [rows, brands, people, teams, configs] = await Promise.all([
    loadSchedules(scoped),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    manager ? db.user.findMany({ where: assignablePeopleWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    db.project.findMany({
      where: { AND: [where, { department: { not: null } }] },
      select: { department: true },
      distinct: ["department"],
      orderBy: { department: "asc" },
    }),
    db.fiscalYearConfig.findMany(),
  ]);
  const filtered = rows.filter((r) => {
    const s = r.summary.state;
    if (state === "SLIPPED") return s === "SLIPPED" || s === "DONE_LATE";
    if (state === "ACTIVE") return !s.startsWith("DONE");
    if (state === "DONE") return s.startsWith("DONE");
    if (state === "EXTENDED") return r.summary.enhancementExtensionDays > 0;
    return true;
  });
  // Delayed first, then by target date, so problems are at the top.
  const rank = { SLIPPED: 0, DONE_LATE: 1, ON_PLAN: 2, PULLED_IN: 3, DONE_ON_TIME: 4, UNSCHEDULED: 5 } as const;
  filtered.sort(
    (a, b) =>
      rank[a.summary.state] - rank[b.summary.state] ||
      b.summary.slipDays - a.summary.slipDays ||
      (a.summary.currentTarget?.getTime() ?? Infinity) - (b.summary.currentTarget?.getTime() ?? Infinity),
  );
  const gantt = filtered.map(toGanttRow);
  const today = localToday();
  const range = ganttRange(gantt, today, configs);

  const scheduled = filtered.filter((r) => r.summary.state !== "UNSCHEDULED");
  const delayed = filtered.filter((r) => r.summary.state === "SLIPPED");
  const delivered = filtered.filter((r) => r.summary.state.startsWith("DONE"));
  const onTime = delivered.filter((r) => r.summary.state === "DONE_ON_TIME");
  const extended = filtered.filter((r) => r.summary.enhancementExtensionDays > 0);
  const avgSlip = delayed.length ? Math.round(delayed.reduce((s, r) => s + r.summary.slipDays, 0) / delayed.length) : 0;
  const reasonTotals = new Map<string | null, number>();
  for (const r of filtered) for (const x of r.reasons) reasonTotals.set(x.reason, (reasonTotals.get(x.reason) ?? 0) + x.count);
  const reasons = [...reasonTotals.entries()].sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(1, ...reasons.map(([, n]) => n));
  const keep = (extra: Record<string, string>) =>
    new URLSearchParams(
      Object.entries({ scope, owner, brand: brand ?? "", team: team ?? "", state, ...extra }).filter(([, v]) => v && v !== "ALL"),
    ).toString();

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Projects / Timeline</p>
          <h1 className="page-title">Project timeline</h1>
          <p className="page-subtitle">
            Each project&apos;s plan against its original target. Hover a row to see why its date moved.
          </p>
        </div>
        <nav className="view-switch" aria-label="Project views">
          <Link href="/dashboard/projects">Cards</Link>
          <Link href="/dashboard/board">Board</Link>
          <Link href="/dashboard/projects/timeline" aria-current="page">
            Timeline
          </Link>
        </nav>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        {manager && (
          <AutoSubmitSelect
            name="scope"
            defaultValue={scope}
            options={[
              { value: "all", label: "All projects" },
              { value: "mine", label: "My projects" },
            ]}
          />
        )}
        {manager && (
          <AutoSubmitSelect
            name="owner"
            defaultValue={owner}
            options={[{ value: "ALL", label: "All owners" }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
          />
        )}
        <AutoSubmitSelect
          name="brand"
          defaultValue={brand ?? "ALL"}
          options={[{ value: "ALL", label: "All brands" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
        />
        <AutoSubmitSelect
          name="team"
          defaultValue={team ?? "ALL"}
          options={[
            { value: "ALL", label: "All teams" },
            ...teams.flatMap((t) => (t.department ? [{ value: t.department, label: t.department }] : [])),
          ]}
        />
        <AutoSubmitSelect name="state" defaultValue={state} options={STATE_FILTERS} />
      </form>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Schedule summary">
        {[
          [String(scheduled.length), "Projects with a target"],
          [String(delayed.length), "Delayed now", delayed.length ? `avg +${avgSlip} days vs original` : ""],
          [delivered.length ? `${Math.round((onTime.length / delivered.length) * 100)}%` : "—", "Delivered on time", `${onTime.length} of ${delivered.length}`],
          [String(extended.length), "Extended by enhancements"],
          [String(reasons.reduce((s, [, n]) => s + n, 0)), "Target date changes"],
        ].map(([value, label, note]) => (
          <div key={label} className="surface !p-4">
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-600">{label}</p>
            {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
          </div>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[1fr_300px]">
        <section className="surface min-w-0">
          {gantt.length ? (
            <ScheduleGantt rows={gantt} min={range.min} max={range.max} ticks={range.ticks} today={dayKey(today)!} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No projects match these filters.</p>
          )}
        </section>
        <aside className="surface">
          <h2 className="section-title">Why target dates moved</h2>
          <p className="mt-1 text-xs text-muted-foreground">Count of target-date changes in the projects shown.</p>
          <ul className="mt-4 space-y-2.5">
            {reasons.map(([reason, n]) => (
              <li key={reason ?? "none"} title={`${reasonLabel(reason)}: ${n} change${n === 1 ? "" : "s"}`}>
                <div className="flex justify-between gap-2 text-xs text-slate-700">
                  <span className="truncate">{reasonLabel(reason)}</span>
                  <span className="font-semibold text-slate-900">{n}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100">
                  <div className="h-2 rounded" style={{ width: `${(n / maxReason) * 100}%`, background: "#0084D4" }} />
                </div>
              </li>
            ))}
            {!reasons.length && <li className="text-sm text-muted-foreground">No target dates have moved.</li>}
          </ul>
          {state !== "SLIPPED" && delayed.length > 0 && (
            <Link className="text-link mt-4 inline-block text-xs" href={`?${keep({ state: "SLIPPED" })}`}>
              Show delayed projects only →
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

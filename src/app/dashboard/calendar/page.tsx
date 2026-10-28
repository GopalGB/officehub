import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { projectAccessWhere, isManagerOrAbove } from "@/lib/rbac";
import {
  fiscalWeeks,
  localToday,
  fiscalPeriod,
  dateKey,
  addDays,
  companyFiscalCalendar,
  FISCAL_MONTH_NAMES,
} from "@/lib/fiscal";
import { formatDate, isOverdueDate } from "@/lib/utils";
import { saveFiscalConfig } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
export default async function FiscalCalendar({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; period?: string; scope?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const configs = await db.fiscalYearConfig.findMany();
  const today = fiscalPeriod(localToday(), configs);
  const rawYear = Number(params.year),
    rawPeriod = Number(params.period);
  const year =
    Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100
      ? rawYear
      : (today?.year ?? new Date().getUTCFullYear());
  const period =
    Number.isInteger(rawPeriod) && rawPeriod >= 1 && rawPeriod <= 12
      ? rawPeriod
      : year === today?.year
        ? today.month
        : 1;
  const weeks = fiscalWeeks(year, configs),
    selected = weeks.filter((w) => w.month === period);
  const official = companyFiscalCalendar(year);
  const manager = isManagerOrAbove(session.user.role),
    scope = manager && params.scope !== "mine" ? "all" : "mine";
  const access = projectAccessWhere({
    id: session.user.id,
    role: scope === "all" ? session.user.role : "MEMBER",
  });
  const range = {
    gte: weeks[0].start,
    lt: addDays(weeks[weeks.length - 1].end, 1),
  };
  const [projects, milestones, reports, enhancements] = await Promise.all([
    db.project.findMany({
      where: { AND: [access], targetDate: range },
      select: { id: true, title: true, targetDate: true, status: true },
    }),
    db.milestone.findMany({
      where: { project: access, dueDate: range },
      include: { project: { select: { title: true } } },
    }),
    db.task.findMany({
      where: { project: access, dueDate: range },
      select: {
        id: true,
        title: true,
        projectId: true,
        dueDate: true,
        status: true,
      },
    }),
    db.enhancement.findMany({
      where: { project: access, targetDate: range },
      select: {
        id: true,
        title: true,
        projectId: true,
        targetDate: true,
        status: true,
      },
    }),
  ]);
  const events = [
    ...projects.map((p) => ({
      id: p.id,
      title: p.title,
      date: p.targetDate!,
      href: `/dashboard/projects/${p.id}`,
      kind: "Project",
      done: ["COMPLETED", "ARCHIVED"].includes(p.status),
    })),
    ...milestones.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.dueDate!,
      href: `/dashboard/projects/${m.projectId}`,
      kind: "Milestone",
      done: m.completed,
    })),
    ...reports.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.dueDate!,
      href: `/dashboard/reports/${r.id}`,
      kind: "Report",
      done: r.status === "DONE",
    })),
    ...enhancements.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.targetDate!,
      href: `/dashboard/projects/${e.projectId}?tab=enhancements`,
      kind: "Enhancement",
      done: e.status === "DONE",
    })),
  ];
  const query = (fy: number, p = period) =>
    `?year=${fy}&period=${p}&scope=${scope}`;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Retail planning / Company 4-5-4</p>
          <h1 className="page-title">Fiscal calendar</h1>
          <p className="page-subtitle">
            FY{year} · {weeks.length} weeks · Sunday–Saturday. Delivery dates,
            reports, and enhancements in your fiscal rhythm.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="text-link" href={query(year - 1)}>
            ← FY{year - 1}
          </Link>
          <Link className="text-link" href="/dashboard/calendar">
            Current year
          </Link>
          <Link className="text-link" href={query(year + 1)}>
            FY{year + 1} →
          </Link>
        </div>
      </header>
      {official && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5">
          <div>
            <p className="text-sm font-semibold">Official FY{year} calendar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aligned with your supplied fiscal calendar.
              {year === 2028 ? " Week 53 belongs to January / Period 12." : ""}
            </p>
          </div>
          <a
            href={`/fiscal-calendars/${year}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            View original PDF <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Fiscal year: {formatDate(weeks[0].start)} –{" "}
          {formatDate(weeks[weeks.length - 1].end)}
          {official
            ? " · Official company calendar"
            : configs.some((c) => c.year === year)
              ? " · Custom year alignment"
              : " · NRF year alignment"}
        </p>
        {manager && (
          <div className="flex gap-3 text-sm">
            <Link
              className="text-link"
              href={`?year=${year}&period=${period}&scope=mine`}
            >
              My projects
            </Link>
            <Link
              className="text-link"
              href={`?year=${year}&period=${period}&scope=all`}
            >
              All projects
            </Link>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => {
          const list = weeks.filter((w) => w.month === i + 1),
            count = events.filter(
              (e) =>
                e.date >= list[0].start &&
                e.date < addDays(list[list.length - 1].end, 1),
            ).length;
          return (
            <Link
              key={i}
              className={`rounded-lg border bg-card p-3 ${period === i + 1 ? "border-brand-orange ring-1 ring-brand-orange" : "border-border"}`}
              href={query(year, i + 1)}
            >
              <p className="text-xs font-semibold">
                {FISCAL_MONTH_NAMES[i]}{" "}
                <span className="ml-1 font-normal text-muted-foreground">
                  P{i + 1} · Q{Math.floor(i / 3) + 1}
                </span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {list.length} weeks · FW{list[0].week}–
                {list[list.length - 1].week}
              </p>
              <p className="mt-2 text-xs">{count} deadlines</p>
            </Link>
          );
        })}
      </div>
      <section className="surface space-y-5">
        <div>
          <h2 className="section-title">
            {FISCAL_MONTH_NAMES[period - 1]} · Period {period} · Quarter{" "}
            {Math.ceil(period / 3)}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(selected[0].start)} –{" "}
            {formatDate(selected[selected.length - 1].end)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[70px_repeat(7,minmax(0,1fr))] gap-1 border-b pb-2 text-center text-[11px] text-muted-foreground">
              <span>Fiscal week</span>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            {selected.map((w) => (
              <div
                key={w.week}
                className="grid grid-cols-[70px_repeat(7,minmax(0,1fr))] border-b"
              >
                <Link
                  className="py-4 text-xs font-semibold text-brand-link"
                  href={`/dashboard/planner?week=${dateKey(w.start)}`}
                >
                  FW{String(w.week).padStart(2, "0")}
                </Link>
                {Array.from({ length: 7 }, (_, i) => {
                  const date = addDays(w.start, i),
                    key = dateKey(date),
                    entries = events.filter((e) => dateKey(e.date) === key);
                  return (
                    <div
                      key={i}
                      className={`min-h-28 border-l p-2 ${key === dateKey(localToday()) ? "bg-brand-tint dark:bg-slate-800" : ""}`}
                    >
                      <p className="text-xs font-medium">
                        {date.getUTCDate()}{" "}
                        <span className="text-[9px] text-muted-foreground">
                          {date.toLocaleString("en", {
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </span>
                      </p>
                      <div className="mt-2 space-y-1">
                        {entries.map((e) => (
                          <Link
                            key={e.kind + e.id}
                            className={`block rounded-md border px-1.5 py-1 text-[10px] ${e.done ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : isOverdueDate(e.date) ? "bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-200" : "bg-secondary text-foreground"}`}
                            href={e.href}
                          >
                            <span className="block text-[8px] uppercase tracking-wide">
                              {e.kind}
                              {e.done ? " · Done" : ""}
                            </span>
                            <span className="line-clamp-2">{e.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
      {manager && !official && (
        <details className="surface">
          <summary className="cursor-pointer text-sm font-semibold">
            Align a fiscal year with your company calendar
          </summary>
          <p className="page-subtitle">
            FY2026–2028 use the supplied company calendars. Other years default
            to NRF 4-5-4. Enter a Sunday start and 52 or 53 weeks to override
            this year. A 53rd week is added to Period 12.
          </p>
          <div className="mt-4">
            <ActionForm
              action={saveFiscalConfig}
              label="Save fiscal alignment"
              successMessage="Fiscal calendar updated."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="field">
                  Fiscal year
                  <input
                    name="year"
                    type="number"
                    min="2000"
                    max="2100"
                    defaultValue={year}
                    required
                  />
                </label>
                <label className="field">
                  Start date (Sunday)
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={dateKey(weeks[0].start)}
                    required
                  />
                </label>
                <label className="field">
                  Weeks
                  <select name="weeks" defaultValue={weeks.length}>
                    <option value="52">52</option>
                    <option value="53">53</option>
                  </select>
                </label>
              </div>
            </ActionForm>
          </div>
        </details>
      )}
    </div>
  );
}

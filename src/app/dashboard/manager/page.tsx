import { assignablePeopleWhere } from "@/lib/project-people";
import {
  weekStart,
  addDays,
  dateKey,
  localToday,
  fiscalLabel,
} from "@/lib/fiscal";
import { dayLoad } from "@/lib/planning";
import { summarizePeopleProjects } from "@/lib/project-summary";
import { TeamProjectSummary } from "@/components/dashboard/TeamProjectSummary";
import { ProjectStatusEnum } from "@/lib/validation";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PriorityBadge,
  ProjectStatusBadge,
  PROJECT_STATUS_OPTIONS,
} from "@/components/project/StatusBadge";
import { Select } from "@/components/ui/select";
import { formatDate, timeAgo } from "@/lib/utils";

const STATUS_TILES: { label: string; key: ProjectStatus; tone: string }[] = [
  {
    label: "Planning",
    key: "PLANNING",
    tone: "bg-secondary text-brand-navy",
  },
  {
    label: "In Progress",
    key: "IN_PROGRESS",
    tone: "bg-brand-blue/10 text-brand-link",
  },
  {
    label: "Blocked",
    key: "BLOCKED",
    tone: "bg-red-50 text-red-700",
  },
  {
    label: "On Hold",
    key: "ON_HOLD",
    tone: "bg-brand-tint text-brand-navy",
  },
  {
    label: "Completed",
    key: "COMPLETED",
    tone: "bg-emerald-50 text-emerald-800",
  },
];

/** Guard before querying team work; the aggregate and detailed views share that boundary. */
export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    owner?: string;
    q?: string;
    day?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isManagerOrAbove(session.user.role)) redirect("/dashboard");

  const { status, owner, q, day } = await searchParams;
  const summaryDay = localToday();

  const parsedStatus = ProjectStatusEnum.safeParse(status);
  const where = {
    ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
    ...(owner && owner !== "ALL" ? { ownerId: owner } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { summary: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [projects, owners, counts, overdueCount] = await Promise.all([
    db.project.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [
        { status: "asc" },
        { targetDate: "asc" },
        { updatedAt: "desc" },
      ],
      take: 200,
    }),
    db.user.findMany({
      where: assignablePeopleWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.project.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.project.count({
      where: {
        targetDate: { lt: summaryDay },
        status: { in: ["PLANNING", "IN_PROGRESS", "BLOCKED", "ON_HOLD"] },
      },
    }),
  ]);

  const selectedDay =
    day &&
    /^\d{4}-\d\d-\d\d$/.test(day) &&
    !Number.isNaN(new Date(day).getTime())
      ? new Date(day)
      : null;
  const today = selectedDay ?? localToday();
  const start = weekStart(today);
  const [
    people,
    plans,
    portfolioProjects,
    openReports,
    pendingRequests,
    configs,
    weekLeaves,
    notActive,
    openHelp,
  ] = await Promise.all([
    db.user.findMany({
      where: assignablePeopleWhere,
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.workPlan.findMany({
      where: { weekStart: start },
      include: { overrides: true, project: { select: { title: true } } },
    }),
    db.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        ownerId: true,
        coOwnerId: true,
        status: true,
        targetDate: true,
        members: { select: { id: true } },
      },
    }),
    db.task.findMany({
      where: { status: { not: "DONE" } },
      select: { id: true, title: true, assigneeId: true },
    }),
    db.projectRequest.count({ where: { status: "PENDING" } }),
    db.fiscalYearConfig.findMany(),
    db.leave.findMany({
      where: { startDate: { lte: addDays(start, 6) }, endDate: { gte: start } },
      select: { userId: true, personName: true, type: true, startDate: true, endDate: true },
    }),
    db.user.findMany({
      where: { active: true, notActive: true, role: { not: "ADMIN" } },
      select: { id: true, name: true, team: true },
      orderBy: { name: "asc" },
    }),
    db.helpRequest.count({ where: { status: "OPEN" } }),
  ]);
  const leaveOn = (person: { id: string; name: string }, date: Date) =>
    weekLeaves.find(
      (l) =>
        (l.userId === person.id || l.personName.trim().toLowerCase() === person.name.trim().toLowerCase()) &&
        l.startDate <= date &&
        l.endDate >= date,
    );
  const activeProjects = portfolioProjects.filter(
    (project) => project.status !== "COMPLETED",
  );
  const peopleSummary = summarizePeopleProjects(
    people,
    portfolioProjects,
    summaryDay,
  );
  const projectNames = Object.fromEntries(
    activeProjects.map((p) => [p.id, p.title]),
  );
  const byStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count.status]),
  );

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team overview</h1>
        <p className="text-sm text-slate-500">
          See who is working on what, today and throughout the fiscal week. All
          projects and reports are visible to managers and administrators.
        </p>
      </header>

      <TeamProjectSummary rows={peopleSummary} asOf={summaryDay} />
      <section className="surface space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Team commitments</h2>
            <form className="mt-3 flex items-end gap-2">
              <label className="field">
                View work for
                <input type="date" name="day" defaultValue={dateKey(today)} />
              </label>
              <button
                className="rounded-md border bg-card px-3 py-2 text-xs font-medium"
                type="submit"
              >
                View day
              </button>
            </form>
            <p className="mt-1 text-xs text-muted-foreground">
              {fiscalLabel(today, configs)} · Monday to Friday
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm">
            <Link className="text-link" href="/dashboard/requests">
              Request intake · {pendingRequests} pending →
            </Link>
            <Link className="text-link" href="/dashboard/help">
              Help pool · {openHelp} open →
            </Link>
            <Link className="text-link" href="/dashboard/leaves">
              Leaves this week · {new Set(weekLeaves.map((l) => l.personName)).size} people →
            </Link>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {people.map((person) => {
            const own = plans.filter((p) => p.userId === person.id),
              todayLoad = dayLoad(own, today);
            const daily = [1, 2, 3, 4, 5].map((i) =>
                dayLoad(own, addDays(start, i)),
              ),
              blocks = daily.reduce((sum, d) => sum + d.entries.length, 0);
            const owned = activeProjects.filter(
              (p) =>
                p.ownerId === person.id ||
                p.coOwnerId === person.id ||
                p.members.some((m) => m.id === person.id),
            );
            const reports = openReports.filter(
              (r) => r.assigneeId === person.id,
            );
            return (
              <article key={person.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{person.name}</h3>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {owned.length} active projects · {reports.length} open
                      reports
                    </p>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    {leaveOn(person, today) && (
                      <span className="pill !bg-brand-tint !text-brand-orange">
                        {leaveOn(person, today)!.type} today
                      </span>
                    )}
                    <span className="pill">
                      {blocks} focus block{blocks === 1 ? "" : "s"} this week
                    </span>
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-1">
                  {daily.map((d, i) => (
                    <div
                      key={i}
                      className={`rounded px-1 py-1.5 text-center ${leaveOn(person, addDays(start, i + 1)) ? "bg-brand-tint" : "bg-secondary"}`}
                      title={`${["Mon", "Tue", "Wed", "Thu", "Fri"][i]}: ${d.entries.length} focus blocks`}
                    >
                      <p className="text-[9px] text-muted-foreground">
                        {["Mon", "Tue", "Wed", "Thu", "Fri"][i]}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold">
                        {leaveOn(person, addDays(start, i + 1))
                          ? "Leave"
                          : d.entries.length || "–"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Focus for {formatDate(today)}
                  </p>
                  {todayLoad.entries.map((entry) => (
                    <p key={entry.planId} className="mt-2 text-xs">
                      <strong>{entry.title}</strong>
                      {entry.adjusted && (
                        <span className="text-muted-foreground">
                          {" "}
                          (changed for this day)
                        </span>
                      )}
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {projectNames[entry.projectId] ??
                          own.find((p) => p.projectId === entry.projectId)
                            ?.project.title ??
                          "Project"}
                      </span>
                    </p>
                  ))}
                  {!todayLoad.entries.length && (
                    <p className="text-xs text-muted-foreground">
                      No focus blocks planned for today.
                    </p>
                  )}
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-brand-link">
                    Projects, reports, and this week’s plan
                  </summary>
                  <div className="mt-3 space-y-2 text-xs">
                    {owned.map((p) => (
                      <p key={p.id}>
                        <Link
                          className="text-link"
                          href={`/dashboard/projects/${p.id}`}
                        >
                          {p.title}
                        </Link>
                        {p.ownerId === person.id
                          ? " · Owner"
                          : p.coOwnerId === person.id
                            ? " · Sub-owner"
                            : " · Collaborator"}
                      </p>
                    ))}
                    {reports.map((r) => (
                      <p key={r.id}>
                        <Link
                          className="text-link"
                          href={`/dashboard/reports/${r.id}`}
                        >
                          {r.title}
                        </Link>{" "}
                        · Report
                      </p>
                    ))}
                    {own.map((p) => (
                      <p key={p.id}>
                        {p.title} ·{" "}
                        {p.weekdays
                          .filter((d) => d > 0 && d < 6)
                          .map(
                            (d) => ["Mon", "Tue", "Wed", "Thu", "Fri"][d - 1],
                          )
                          .join(", ")}
                      </p>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
        {notActive.length > 0 && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Not active (not offered for new work):{" "}
            {notActive.map((p) => p.name + (p.team ? ` (${p.team})` : "")).join(", ")}
          </p>
        )}
      </section>
      <details
        className="disclosure"
        open={!!(q || (owner && owner !== "ALL") || parsedStatus.success)}
      >
        <summary>Portfolio details & filters</summary>
        <div className="disclosure-body">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {STATUS_TILES.map((s) => (
              <Card key={s.key}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-slate-500">
                    {s.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p
                    className={`inline-block rounded px-2 py-0.5 text-xl font-semibold ${s.tone}`}
                  >
                    {byStatus[s.key] ?? 0}
                  </p>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-slate-500">
                  Overdue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="inline-block rounded bg-red-50 px-2 py-0.5 text-xl font-semibold text-red-700">
                  {overdueCount}
                </p>
              </CardContent>
            </Card>
          </div>

          <form
            className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-white p-3"
            method="get"
          >
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search title or summary…"
              className="h-9 min-w-[200px] flex-1 rounded border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <Select
              name="status"
              defaultValue={status ?? "ALL"}
              className="h-9 w-[160px]"
            >
              <option value="ALL">All statuses</option>
              {PROJECT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              name="owner"
              defaultValue={owner ?? "ALL"}
              className="h-9 w-[200px]"
            >
              <option value="ALL">All owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <button
              type="submit"
              className="h-9 rounded-lg bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navy/90"
            >
              Apply
            </button>
            <Link
              href="/dashboard/manager"
              className="flex h-9 items-center text-sm text-slate-500 hover:text-slate-900"
            >
              Reset
            </Link>
          </form>

          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      No projects match these filters.
                    </td>
                  </tr>
                )}
                {projects.map((p) => {
                  const isOverdue =
                    p.targetDate &&
                    new Date(p.targetDate) < new Date() &&
                    !["COMPLETED", "ARCHIVED"].includes(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.title}
                        </Link>
                        {p.summary && (
                          <p className="line-clamp-1 text-xs text-slate-500">
                            {p.summary}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-black">{p.owner.name}</td>
                      <td className="px-4 py-3">
                        <ProjectStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={p.priority} />
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${isOverdue ? "font-semibold text-black underline decoration-2 underline-offset-2 dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}
                      >
                        {formatDate(p.targetDate)}
                        {isOverdue && (
                          <span className="ml-1 text-xs">(overdue)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {timeAgo(p.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}

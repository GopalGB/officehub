import Link from "next/link";
import { redirect } from "next/navigation";
import { Flag, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}
function endOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}
function startOfGrid(year: number, month: number) {
  const first = startOfMonth(year, month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; scope?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { y, m, scope = "mine" } = await searchParams;
  const now = new Date();
  const year = y ? parseInt(y, 10) : now.getFullYear();
  const month = m !== undefined ? parseInt(m, 10) : now.getMonth();
  const monthStart = startOfMonth(year, month);
  const monthEnd = endOfMonth(year, month);
  const safeScope = session.user.role === "MEMBER" ? "mine" : scope;

  const milestonesWhere: Record<string, unknown> = {
    dueDate: { gte: monthStart, lte: monthEnd },
  };
  const tasksWhere: Record<string, unknown> = {
    dueDate: { gte: monthStart, lte: monthEnd },
  };
  if (safeScope === "mine") {
    milestonesWhere.project = { ownerId: session.user.id };
    tasksWhere.assigneeId = session.user.id;
  }

  const [milestones, tasks] = await Promise.all([
    db.milestone.findMany({
      where: milestonesWhere,
      include: { project: { select: { id: true, title: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.task.findMany({
      where: tasksWhere,
      include: {
        project: { select: { id: true, title: true } },
        assignee: { select: { name: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    }),
  ]);

  // Build map: dateKey → events
  type Event = {
    id: string;
    kind: "milestone" | "task";
    title: string;
    projectId: string;
    projectTitle: string;
    completed?: boolean;
    overdue?: boolean;
  };
  const byDay = new Map<string, Event[]>();
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  for (const m of milestones) {
    if (!m.dueDate) continue;
    const k = key(new Date(m.dueDate));
    const arr = byDay.get(k) ?? [];
    arr.push({
      id: m.id,
      kind: "milestone",
      title: m.title,
      projectId: m.project.id,
      projectTitle: m.project.title,
      completed: m.completed,
      overdue: !m.completed && new Date(m.dueDate) < now,
    });
    byDay.set(k, arr);
  }
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const k = key(new Date(t.dueDate));
    const arr = byDay.get(k) ?? [];
    arr.push({
      id: t.id,
      kind: "task",
      title: t.title,
      projectId: t.project.id,
      projectTitle: t.project.title,
      completed: t.status === "DONE",
      overdue: t.status !== "DONE" && new Date(t.dueDate) < now,
    });
    byDay.set(k, arr);
  }

  const gridStart = startOfGrid(year, month);
  // 42 cells = 6 weeks
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-slate-500">Milestones + tasks across the month.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManagerOrAbove(session.user.role) && (
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
              <Link
                href={`?y=${year}&m=${month}&scope=mine`}
                className={`rounded px-3 py-1.5 ${safeScope === "mine" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Mine
              </Link>
              <Link
                href={`?y=${year}&m=${month}&scope=all`}
                className={`rounded px-3 py-1.5 ${safeScope === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                All
              </Link>
            </div>
          )}
          <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
            <Link
              href={`?y=${prev.getFullYear()}&m=${prev.getMonth()}&scope=${safeScope}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={`?scope=${safeScope}`}
              className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Today
            </Link>
            <span className="px-2 text-sm font-semibold">
              {MONTH_NAMES[month]} {year}
            </span>
            <Link
              href={`?y=${next.getFullYear()}&m=${next.getMonth()}&scope=${safeScope}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const today = sameDay(d, now);
            const events = byDay.get(key(d)) ?? [];
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[88px] border-b border-r border-slate-100 p-1.5 last:border-r-0",
                  i >= 35 && "border-b-0",
                  !inMonth && "bg-slate-50/60",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                      today
                        ? "bg-slate-900 text-white"
                        : inMonth
                        ? "text-slate-700"
                        : "text-slate-400",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {events.slice(0, 3).map((e) => (
                    <Link
                      key={`${e.kind}-${e.id}`}
                      href={`/dashboard/projects/${e.projectId}`}
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:opacity-90",
                        e.completed
                          ? "bg-emerald-50 text-emerald-700"
                          : e.overdue
                          ? "bg-rose-50 text-rose-700"
                          : e.kind === "milestone"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-indigo-50 text-indigo-700",
                      )}
                      title={`${e.title} — ${e.projectTitle}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {e.kind === "milestone" ? (
                          <Flag className="h-2.5 w-2.5 shrink-0" />
                        ) : (
                          <CheckSquare className="h-2.5 w-2.5 shrink-0" />
                        )}
                        <span className="truncate">{e.title}</span>
                      </span>
                    </Link>
                  ))}
                  {events.length > 3 && (
                    <p className="px-1 text-[10px] text-slate-500">+{events.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-200" /> Milestone
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-indigo-200" /> Task
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-200" /> Completed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-rose-200" /> Overdue
        </span>
      </div>
    </div>
  );
}

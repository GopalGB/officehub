import Link from "next/link";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { projectAccessWhere } from "@/lib/rbac";
import {
  weekStart,
  dateKey,
  addDays,
  localToday,
  fiscalLabel,
} from "@/lib/fiscal";
import { plannedDay, dayLoad } from "@/lib/planning";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  saveWorkPlan,
  deleteWorkPlan,
  saveDailyOverride,
  resetDailyOverride,
  copyPreviousWeek,
} from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const validDate = (value?: string) =>
    value &&
    /^\d{4}-\d\d-\d\d$/.test(value) &&
    !Number.isNaN(new Date(value).getTime())
      ? new Date(value)
      : null;
  const start = weekStart(validDate(params.week) ?? localToday());
  const candidate = validDate(params.day) ?? localToday();
  const selected =
    candidate >= start && candidate < addDays(start, 7)
      ? candidate
      : addDays(start, 1);
  const [plans, projects, configs, history] = await Promise.all([
    db.workPlan.findMany({
      where: {
        userId: session.user.id,
        weekStart: start,
        project: projectAccessWhere(session.user),
      },
      include: { overrides: true },
      orderBy: { startTime: "asc" },
    }),
    db.project.findMany({
      where: projectAccessWhere(session.user),
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.fiscalYearConfig.findMany(),
    db.auditLog.findMany({
      where: {
        userId: session.user.id,
        entity: { in: ["WorkPlan", "DailyOverride"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const names = Object.fromEntries(projects.map((p) => [p.id, p.title]));
  const week = dateKey(start);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            Personal planning / {fiscalLabel(start, configs)}
          </p>
          <h1 className="page-title">My week</h1>
          <p className="page-subtitle">
            Plan your project focus once. Adjust a single day whenever
            priorities change.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            className="text-link"
            href={`?week=${dateKey(addDays(start, -7))}`}
          >
            ← Previous
          </Link>
          <Link className="text-link" href="/dashboard/planner">
            Today
          </Link>
          <Link
            className="text-link"
            href={`?week=${dateKey(addDays(start, 7))}`}
          >
            Next →
          </Link>
        </div>
      </header>
      <div className="grid grid-cols-7 gap-1 sm:gap-3">
        {days.map((day) => {
          const load = dayLoad(plans, day),
            key = dateKey(day);
          return (
            <Link
              key={key}
              href={`?week=${week}&day=${key}`}
              className={`min-w-0 rounded-xl border bg-card p-1.5 sm:p-3 ${key === dateKey(selected) ? "border-brand-orange ring-1 ring-brand-orange" : "border-border"}`}
            >
              <p className="text-[10px] font-medium sm:text-xs">
                {weekdays[day.getUTCDay()]}
              </p>
              <p className="mt-1 hidden text-[11px] text-muted-foreground lg:block">
                {formatDate(day)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground lg:hidden">
                {day.getUTCDate()}
              </p>
              <p className="mt-3 text-[11px] font-semibold sm:text-base lg:text-lg">
                {load.hours}h
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={
                    load.hours > 8
                      ? "h-full bg-brand-orange"
                      : "h-full bg-brand-blue"
                  }
                  style={{ width: `${Math.min(100, (load.hours / 8) * 100)}%` }}
                />
              </div>
              <p className="mt-2 hidden text-[10px] text-muted-foreground lg:block">
                {load.entries.length} focus block
                {load.entries.length === 1 ? "" : "s"}
                {load.overlap
                  ? " · Overlap"
                  : load.hours > 8
                    ? " · Over capacity"
                    : ""}
              </p>
            </Link>
          );
        })}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section className="surface space-y-5">
          <div>
            <p className="eyebrow">Daily timeline</p>
            <h2 className="section-title">
              {weekdays[selected.getUTCDay()]} · {formatDate(selected)}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Daily changes apply only to this date. The rest of the week stays
              as planned.
            </p>
          </div>
          {dayLoad(plans, selected).overlap && (
            <p
              role="status"
              className="rounded-lg bg-brand-tint p-3 text-sm text-brand-navy"
            >
              Some focus blocks overlap. Adjust their start times below.
            </p>
          )}
          {plans.map((plan) => {
            const entry = plannedDay(plan, selected);
            if (!entry) return null;
            return (
              <article
                key={plan.id}
                className={`relative border-l-2 pl-4 ${entry.skipped ? "border-border opacity-70" : "border-brand-orange"}`}
              >
                <div className="flex justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {entry.startTime} · {entry.hours} hours
                  </p>
                  <span className="pill">
                    {entry.skipped
                      ? "Skipped"
                      : entry.adjusted
                        ? "Adjusted for today"
                        : "Weekly plan"}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold">{entry.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {names[entry.projectId] ?? "Project no longer accessible"}
                </p>
                {entry.note && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {entry.note}
                  </p>
                )}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-brand-link">
                    Change this day
                  </summary>
                  <div className="mt-4">
                    <ActionForm
                      action={saveDailyOverride.bind(null, plan.id)}
                      successMessage="Daily plan saved."
                    >
                      <input
                        type="hidden"
                        name="date"
                        value={dateKey(selected)}
                      />
                      <input
                        type="hidden"
                        name="expectedUpdatedAt"
                        value={entry.override?.updatedAt.toISOString() ?? ""}
                      />
                      <label className="field">
                        Project
                        <select name="projectId" defaultValue={entry.projectId}>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Focus
                        <input
                          name="title"
                          required
                          minLength={2}
                          maxLength={200}
                          defaultValue={entry.title}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="field">
                          Start time
                          <input
                            type="time"
                            name="startTime"
                            required
                            defaultValue={entry.startTime}
                          />
                        </label>
                        <label className="field">
                          Hours
                          <input
                            type="number"
                            name="hours"
                            required
                            min="0.25"
                            max="24"
                            step="0.25"
                            defaultValue={entry.hours}
                          />
                        </label>
                      </div>
                      <label className="field">
                        Reason / note
                        <textarea
                          name="note"
                          maxLength={1000}
                          defaultValue={entry.note ?? ""}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="skipped"
                          defaultChecked={entry.skipped}
                        />
                        Skip this focus block today
                      </label>
                    </ActionForm>
                    {entry.override && (
                      <ActionForm
                        action={resetDailyOverride.bind(
                          null,
                          entry.override.id,
                          entry.override.updatedAt.toISOString(),
                        )}
                        label="Reset to weekly plan"
                        className="mt-3"
                      />
                    )}
                  </div>
                </details>
              </article>
            );
          })}
          {!plans.some((p) => plannedDay(p, selected)) && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No work planned for this day. Add a weekly focus block to get
              started.
            </p>
          )}
        </section>
        <div className="space-y-5">
          <section className="surface">
            <h2 className="section-title">Weekly focus blocks</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Week of {formatDate(start)}. Choose the weekdays that repeat this
              focus.
            </p>
            <div className="mt-5 space-y-4">
              {plans.map((plan) => (
                <details key={plan.id} className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {plan.title}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {plan.hours}h / day
                    </span>
                  </summary>
                  <div className="mt-4">
                    <PlanForm plan={plan} week={week} projects={projects} />
                    <ActionForm
                      action={deleteWorkPlan.bind(null, plan.id, plan.version)}
                      label="Remove focus block"
                      className="mt-3"
                    />
                  </div>
                </details>
              ))}
            </div>
            <details open={!plans.length} className="mt-5">
              <summary className="cursor-pointer text-sm font-semibold text-brand-link">
                + Add weekly focus
              </summary>
              <div className="mt-4">
                {projects.length ? (
                  <PlanForm week={week} projects={projects} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Create or join a project first.
                  </p>
                )}
              </div>
            </details>
            {!plans.length && (
              <div className="mt-5 border-t pt-4">
                <ActionForm
                  action={copyPreviousWeek.bind(null, week)}
                  label="Copy previous week"
                  successMessage="Previous week copied. Daily overrides were not copied."
                />
              </div>
            )}
          </section>
          <details className="surface">
            <summary className="cursor-pointer text-sm font-semibold">
              My planning history
            </summary>
            <ol className="mt-4 space-y-4">
              {history.map((e) => (
                <li key={e.id}>
                  <p className="text-xs font-medium">{e.action}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </p>
                </li>
              ))}
              {!history.length && (
                <li className="text-sm text-muted-foreground">
                  Your planning changes will appear here.
                </li>
              )}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
function PlanForm({
  plan,
  week,
  projects,
}: {
  plan?: {
    id: string;
    version: number;
    projectId: string;
    title: string;
    hours: number;
    startTime: string;
    weekdays: number[];
  };
  week: string;
  projects: { id: string; title: string }[];
}) {
  return (
    <ActionForm
      action={saveWorkPlan.bind(null, plan?.id ?? null)}
      label={plan ? "Save weekly focus" : "Add weekly focus"}
      successMessage="Weekly plan saved."
    >
      <input type="hidden" name="weekStart" value={week} />
      {plan && (
        <input type="hidden" name="expectedVersion" value={plan.version} />
      )}
      <label className="field">
        Project
        <select name="projectId" defaultValue={plan?.projectId}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        What will you work on?
        <input
          name="title"
          required
          minLength={2}
          maxLength={200}
          defaultValue={plan?.title}
          placeholder="e.g. Validate the weekly sales report"
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-xs font-medium">Repeat on</legend>
        <div className="flex flex-wrap gap-2">
          {weekdays.map((day, i) => (
            <label
              key={day}
              className="flex items-center gap-1.5 rounded-md border px-2 py-2 text-xs"
            >
              <input
                name="weekdays"
                type="checkbox"
                value={i}
                defaultChecked={
                  plan ? plan.weekdays.includes(i) : i > 0 && i < 6
                }
              />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          Start time
          <input
            name="startTime"
            type="time"
            required
            defaultValue={plan?.startTime ?? "09:00"}
          />
        </label>
        <label className="field">
          Hours per day
          <input
            name="hours"
            type="number"
            required
            min="0.25"
            step="0.25"
            max="24"
            defaultValue={plan?.hours ?? 2}
          />
        </label>
      </div>
    </ActionForm>
  );
}

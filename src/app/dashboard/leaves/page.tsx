import Link from "next/link";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { createLeave, deleteLeave } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { addDays, dateKey, localToday, weekStart } from "@/lib/fiscal";
import { formatDate } from "@/lib/utils";

const TYPES = ["Leave", "Sick leave", "Work from home", "Half day", "Holiday", "Training"];

/** Leaves from the linked Excel tracker plus anything added here. */
export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const manager = isManagerOrAbove(session.user.role);
  const { week } = await searchParams;
  const base = week && /^\d{4}-\d\d-\d\d$/.test(week) && !Number.isNaN(Date.parse(week)) ? new Date(week) : localToday();
  const start = weekStart(base);
  const days = [1, 2, 3, 4, 5].map((i) => addDays(start, i));
  const today = localToday();
  const [weekLeaves, upcoming, people, linked] = await Promise.all([
    db.leave.findMany({
      where: { startDate: { lte: days[4] }, endDate: { gte: days[0] } },
      orderBy: [{ personName: "asc" }, { startDate: "asc" }],
    }),
    db.leave.findMany({
      where: { endDate: { gte: today } },
      orderBy: { startDate: "asc" },
      take: 100,
    }),
    manager
      ? db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
    db.excelLink.count(),
  ]);
  const names = [...new Set(weekLeaves.map((l) => l.personName))];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Team / Leaves</p>
          <h1 className="page-title">Team leaves</h1>
          <p className="page-subtitle">
            Leaves from the linked Excel tracker
            {linked ? "" : " (link one under Linked Excel)"} plus leave added here. People on leave are skipped
            by “whoever is free”.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-link" href={`?week=${dateKey(addDays(start, -7))}`}>
            ← Previous
          </Link>
          <Link className="text-link" href="/dashboard/leaves">
            This week
          </Link>
          <Link className="text-link" href={`?week=${dateKey(addDays(start, 7))}`}>
            Next →
          </Link>
        </div>
      </header>

      <section className="surface overflow-x-auto">
        <h2 className="section-title">Week of {formatDate(days[0])}</h2>
        <table className="mt-3 w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">Person</th>
              {days.map((d) => (
                <th key={dateKey(d)} className={`px-2 py-2 text-center ${dateKey(d) === dateKey(today) ? "text-brand-navy" : ""}`}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri"][d.getUTCDay() - 1]} {d.getUTCDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {names.map((name) => (
              <tr key={name}>
                <td className="py-2 pr-3 font-medium">{name}</td>
                {days.map((d) => {
                  const leave = weekLeaves.find((l) => l.personName === name && l.startDate <= d && l.endDate >= d);
                  return (
                    <td key={dateKey(d)} className="px-1 py-1.5 text-center">
                      {leave && (
                        <span className="block rounded bg-brand-tint px-1 py-1 text-[11px] text-brand-navy" title={leave.note ?? undefined}>
                          {leave.type}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!names.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nobody is on leave this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <section className="surface !p-0">
          <h2 className="section-title px-5 pt-5">Upcoming and current</h2>
          <ul className="mt-3 divide-y">
            {upcoming.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <strong>{l.personName}</strong> · {l.type} · {formatDate(l.startDate)}
                  {dateKey(l.startDate) !== dateKey(l.endDate) && ` – ${formatDate(l.endDate)}`}
                  {l.note && <span className="text-muted-foreground"> · {l.note}</span>}
                </span>
                {l.source === "EXCEL" ? (
                  <span className="pill">From Excel</span>
                ) : (
                  (l.userId === session.user.id || manager) && (
                    <ActionForm action={deleteLeave.bind(null, l.id)} label="Remove" className="" />
                  )
                )}
              </li>
            ))}
            {!upcoming.length && <li className="px-5 py-6 text-sm text-muted-foreground">No upcoming leave.</li>}
          </ul>
        </section>
        <aside className="surface">
          <h2 className="section-title">Add leave</h2>
          <ActionForm action={createLeave} label="Add leave" successMessage="Leave added." className="mt-3 space-y-3">
            {manager && (
              <label className="field">
                Person
                <select name="userId" defaultValue={session.user.id}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {!people.some((p) => p.id === session.user.id) && <option value={session.user.id}>Me</option>}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                From
                <input name="startDate" type="date" required defaultValue={dateKey(today)} />
              </label>
              <label className="field">
                To
                <input name="endDate" type="date" required defaultValue={dateKey(today)} />
              </label>
            </div>
            <label className="field">
              Type
              <select name="type" defaultValue="Leave">
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Note (optional)
              <input name="note" maxLength={300} />
            </label>
          </ActionForm>
        </aside>
      </div>
    </div>
  );
}

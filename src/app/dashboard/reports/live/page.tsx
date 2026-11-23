import Link from "next/link";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, reportAccessWhere } from "@/lib/rbac";
import { AutoRefresh } from "@/components/common/AutoRefresh";
import { TaskStatusBadge, TASK_STATUS_OPTIONS } from "@/components/project/StatusBadge";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { reportKindLabel } from "@/lib/report-kinds";
import { formatDate, isOverdueDate, timeAgo } from "@/lib/utils";

/** Where every open report stands right now, refreshed automatically. */
export default async function LiveReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; scope?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { brand, scope: rawScope } = await searchParams;
  const manager = isManagerOrAbove(session.user.role);
  const scope = manager && rawScope !== "mine" ? "all" : "mine";
  const where = {
    AND: [
      reportAccessWhere(session.user),
      scope === "mine"
        ? { OR: [{ assigneeId: session.user.id }, { reporterId: session.user.id }] }
        : {},
      brand && brand !== "ALL" ? (brand === "NONE" ? { brandId: null } : { brandId: brand }) : {},
    ],
  };
  const since = new Date(Date.now() - 7 * 86400000);
  const [open, doneThisWeek, brands, changes] = await Promise.all([
    db.task.findMany({
      where: { AND: [where, { status: { not: "DONE" } }] },
      include: {
        assignee: { select: { name: true } },
        project: { select: { id: true, title: true } },
        brand: { select: { name: true } },
      },
      orderBy: [{ statusChangedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
      take: 300,
    }),
    db.task.count({ where: { AND: [where, { status: "DONE", completedAt: { gte: since } }] } }),
    db.brand.findMany({ orderBy: { name: "asc" } }),
    db.task.findMany({
      where: { AND: [where, { statusChangedAt: { gte: since } }] },
      select: {
        id: true,
        title: true,
        status: true,
        statusChangedAt: true,
        statusNote: true,
        assignee: { select: { name: true } },
      },
      orderBy: { statusChangedAt: "desc" },
      take: 15,
    }),
  ]);
  const counts = TASK_STATUS_OPTIONS.filter((o) => o.value !== "DONE").map((o) => ({
    ...o,
    count: open.filter((t) => t.status === o.value).length,
  }));
  const overdue = open.filter((t) => isOverdueDate(t.dueDate)).length;
  const byBrand = [...new Set(open.map((t) => t.brand?.name ?? "No brand"))]
    .map((name) => ({ name, count: open.filter((t) => (t.brand?.name ?? "No brand") === name).length }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">
            <Link href="/dashboard/reports">Reports</Link> / Live tracking
          </p>
          <h1 className="page-title">Live report status</h1>
          <AutoRefresh seconds={30} />
        </div>
        <form method="get" className="flex flex-wrap gap-2">
          {manager && (
            <AutoSubmitSelect
              name="scope"
              defaultValue={scope}
              options={[
                { value: "all", label: "Whole team" },
                { value: "mine", label: "Mine" },
              ]}
            />
          )}
          <AutoSubmitSelect
            name="brand"
            defaultValue={brand ?? "ALL"}
            options={[
              { value: "ALL", label: "All brands" },
              { value: "NONE", label: "No brand" },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </form>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map((c) => (
          <div key={c.value} className="surface !p-4">
            <p className="text-2xl font-semibold">{c.count}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
        <div className="surface !p-4">
          <p className={`text-2xl font-semibold ${overdue ? "text-brand-orange" : ""}`}>{overdue}</p>
          <p className="mt-1 text-xs text-muted-foreground">Overdue</p>
        </div>
        <div className="surface !p-4">
          <p className="text-2xl font-semibold text-emerald-700">{doneThisWeek}</p>
          <p className="mt-1 text-xs text-muted-foreground">Done in 7 days</p>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <section className="surface overflow-x-auto !p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Report</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Owner</th>
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5">Last change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {open.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    <Link className="font-medium hover:underline" href={`/dashboard/reports/${t.id}`}>
                      {t.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {reportKindLabel(t.kind)}
                      {t.brand ? ` · ${t.brand.name}` : ""} · {t.project.title}
                    </p>
                    {t.statusNote && <p className="mt-0.5 text-xs text-brand-navy">{t.statusNote}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <TaskStatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-2 text-xs">{t.assignee?.name ?? "Unassigned"}</td>
                  <td className={`px-3 py-2 text-xs ${isOverdueDate(t.dueDate) ? "font-semibold text-brand-orange" : ""}`}>
                    {formatDate(t.dueDate)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{timeAgo(t.statusChangedAt ?? t.updatedAt)}</td>
                </tr>
              ))}
              {!open.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No open reports. Everything is delivered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <aside className="space-y-5">
          <section className="surface">
            <h2 className="section-title">By brand</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {byBrand.map((b) => (
                <li key={b.name} className="flex justify-between">
                  <span>{b.name}</span>
                  <span className="font-semibold">{b.count}</span>
                </li>
              ))}
              {!byBrand.length && <li className="text-muted-foreground">No open reports.</li>}
            </ul>
          </section>
          <section className="surface">
            <h2 className="section-title">Recent status changes</h2>
            <ol className="mt-3 space-y-3">
              {changes.map((c) => (
                <li key={c.id} className="text-xs">
                  <Link className="font-medium hover:underline" href={`/dashboard/reports/${c.id}`}>
                    {c.title}
                  </Link>
                  <span className="mt-1 flex items-center gap-2">
                    <TaskStatusBadge status={c.status} />
                    <span className="text-muted-foreground">
                      {timeAgo(c.statusChangedAt)} · {c.assignee?.name ?? "Unassigned"}
                    </span>
                  </span>
                </li>
              ))}
              {!changes.length && <li className="text-xs text-muted-foreground">No changes this week.</li>}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

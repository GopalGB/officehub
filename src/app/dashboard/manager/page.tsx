import Link from "next/link";
import { redirect } from "next/navigation";
import type { ProjectStatus } from "@prisma/client";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, ProjectStatusBadge, PROJECT_STATUS_OPTIONS } from "@/components/project/StatusBadge";
import { Select } from "@/components/ui/select";
import { formatDate, timeAgo } from "@/lib/utils";

const STATUS_TILES: { label: string; key: ProjectStatus; tone: string }[] = [
  { label: "Planning", key: "PLANNING", tone: "bg-white text-black border border-black/15 dark:bg-black dark:text-white dark:border-white/20" },
  { label: "In Progress", key: "IN_PROGRESS", tone: "bg-neutral-100 text-black border border-black/30 dark:bg-neutral-900 dark:text-white dark:border-white/30" },
  { label: "Blocked", key: "BLOCKED", tone: "bg-white text-black border-2 border-black underline decoration-2 underline-offset-2 dark:bg-black dark:text-white dark:border-white" },
  { label: "On Hold", key: "ON_HOLD", tone: "bg-neutral-50 text-neutral-600 border border-black/15 dark:bg-neutral-900 dark:text-neutral-300 dark:border-white/20" },
  { label: "Completed", key: "COMPLETED", tone: "border-2 border-black bg-white text-black font-semibold border border-black dark:bg-white dark:text-black dark:border-white" },
];

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; owner?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isManagerOrAbove(session.user.role)) redirect("/dashboard");

  const { status, owner, q } = await searchParams;

  const where = {
    ...(status && status !== "ALL" ? { status: status as ProjectStatus } : {}),
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
      orderBy: [{ status: "asc" }, { targetDate: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.project.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.project.count({
      where: {
        targetDate: { lt: new Date() },
        status: { in: ["PLANNING", "IN_PROGRESS", "BLOCKED", "ON_HOLD"] },
      },
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.status]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Manager view</h1>
        <p className="text-sm text-slate-500">All projects across the team. Filter by status, owner, or keyword.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {STATUS_TILES.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className={`inline-block rounded px-2 py-0.5 text-xl font-semibold ${s.tone}`}>
                {byStatus[s.key] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-slate-500">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="inline-block rounded border-2 border-black bg-white px-2 py-0.5 text-xl font-semibold text-black underline decoration-2 underline-offset-2 dark:border-white dark:bg-black dark:text-white">
              {overdueCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <form className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-white p-3" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search title or summary…"
          className="h-9 min-w-[200px] flex-1 rounded border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <Select name="status" defaultValue={status ?? "ALL"} className="h-9 w-[160px]">
          <option value="ALL">All statuses</option>
          {PROJECT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select name="owner" defaultValue={owner ?? "ALL"} className="h-9 w-[200px]">
          <option value="ALL">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="h-9 rounded border-2 border-black bg-white px-4 text-sm font-semibold text-black hover:bg-neutral-50"
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
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
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
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    {p.summary && <p className="line-clamp-1 text-xs text-slate-500">{p.summary}</p>}
                  </td>
                  <td className="px-4 py-3 text-black">{p.owner.name}</td>
                  <td className="px-4 py-3">
                    <ProjectStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={p.priority} />
                  </td>
                  <td className={`px-4 py-3 text-sm ${isOverdue ? "font-semibold text-black underline decoration-2 underline-offset-2 dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}>
                    {formatDate(p.targetDate)}
                    {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(p.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ProjectStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { KanbanCard } from "@/components/project/KanbanCard";
import { Button } from "@/components/ui/button";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const COLUMNS: { status: ProjectStatus; label: string; ring: string }[] = [
  { status: "PLANNING", label: "Planning", ring: "bg-white ring-black/10 dark:bg-neutral-950 dark:ring-white/15" },
  { status: "IN_PROGRESS", label: "In Progress", ring: "bg-neutral-100 ring-black/15 dark:bg-neutral-900 dark:ring-white/15" },
  { status: "BLOCKED", label: "Blocked", ring: "bg-white ring-black dark:bg-neutral-950 dark:ring-white" },
  { status: "ON_HOLD", label: "On Hold", ring: "bg-neutral-50 ring-black/10 dark:bg-neutral-900 dark:ring-white/10" },
  { status: "COMPLETED", label: "Completed", ring: "bg-neutral-100 ring-black/30 dark:bg-white dark:ring-white" },
];

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; owner?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { scope = isManagerOrAbove(session.user.role) ? "all" : "mine", owner } = await searchParams;

  // Members can only see their own
  const safeScope = session.user.role === "MEMBER" ? "mine" : scope;

  const where: Record<string, unknown> = {
    status: { in: COLUMNS.map((c) => c.status) },
  };
  if (safeScope === "mine") where.ownerId = session.user.id;
  if (owner && owner !== "ALL") where.ownerId = owner;

  const [projects, owners] = await Promise.all([
    db.project.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ priority: "desc" }, { targetDate: "asc" }, { updatedAt: "desc" }],
      take: 500,
    }),
    isManagerOrAbove(session.user.role as Role)
      ? db.user.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const byStatus = COLUMNS.map((c) => ({
    ...c,
    items: projects.filter((p) => p.status === c.status),
  }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-slate-500">
            Drag-free Kanban — click the status pill on a card to move it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManagerOrAbove(session.user.role) && (
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
              <Link
                href="?scope=mine"
                className={`rounded px-3 py-1.5 ${safeScope === "mine" ? "border-2 border-black bg-white text-black font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
              >
                Mine
              </Link>
              <Link
                href="?scope=all"
                className={`rounded px-3 py-1.5 ${safeScope === "all" ? "border-2 border-black bg-white text-black font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
              >
                All
              </Link>
            </div>
          )}
          {isManagerOrAbove(session.user.role) && owners.length > 0 && (
            <form method="get" className="inline-flex items-center gap-2">
              <input type="hidden" name="scope" value={safeScope} />
              <AutoSubmitSelect
                name="owner"
                defaultValue={owner ?? "ALL"}
                options={[
                  { value: "ALL", label: "All owners" },
                  ...owners.map((o) => ({ value: o.id, label: o.name })),
                ]}
              />
            </form>
          )}
          <Button asChild>
            <Link href="/dashboard/projects/new">New project</Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {byStatus.map((col) => (
          <div key={col.status} className={`flex min-h-[400px] flex-col gap-2 rounded-md p-2 ring-1 ${col.ring}`}>
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                {col.label}
              </h2>
              <span className="text-xs font-semibold text-slate-500">{col.items.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {col.items.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-slate-400">No projects</p>
              ) : (
                col.items.map((p) => {
                  const canEdit =
                    isManagerOrAbove(session.user.role) || p.ownerId === session.user.id;
                  return <KanbanCard key={p.id} project={p} canEdit={canEdit} />;
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

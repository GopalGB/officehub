import Link from "next/link";
import type { ProjectStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { ProjectBoardClient } from "@/components/project/ProjectBoardClient";
import { Button } from "@/components/ui/button";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const COLUMNS: { status: ProjectStatus; label: string; tone: string; wipLimit?: number }[] = [
  { status: "PLANNING", label: "Planning", tone: "bg-white ring-black/10" },
  { status: "IN_PROGRESS", label: "In Progress", tone: "bg-neutral-50 ring-black/15", wipLimit: 8 },
  { status: "BLOCKED", label: "Blocked", tone: "bg-white ring-black" },
  { status: "ON_HOLD", label: "On Hold", tone: "bg-neutral-50 ring-black/10" },
  { status: "COMPLETED", label: "Completed", tone: "bg-neutral-50 ring-black/30" },
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
  if (safeScope === "mine") {
    // Members see projects they own OR are explicitly added to.
    where.OR = [
      { ownerId: session.user.id },
      { members: { some: { id: session.user.id } } },
    ];
  }
  if (owner && owner !== "ALL") where.ownerId = owner;

  const [projects, owners] = await Promise.all([
    db.project.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: [{ orderIndex: "asc" }, { priority: "desc" }, { targetDate: "asc" }, { updatedAt: "desc" }],
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

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-slate-500">
            Drag a project card across columns or reorder it within a column. Keyboard: Tab to focus, Space to grab, arrows to move, Space to drop, Esc to cancel.
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

      <ProjectBoardClient
        columns={COLUMNS}
        initialProjects={projects}
        viewerId={session.user.id}
        canEditByOwner={isManagerOrAbove(session.user.role)}
      />
      <p className="text-xs text-neutral-400">
        Drag freely across columns or reorder within. Cards you don&apos;t own show a lock icon.
      </p>
    </div>
  );
}

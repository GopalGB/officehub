import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, canEditProject } from "@/lib/rbac";
import { projectBoardFilters } from "@/lib/project-board";
import { assignablePeopleWhere } from "@/lib/project-people";
import { ProjectBoardClient } from "@/components/project/ProjectBoardClient";
import { Button } from "@/components/ui/button";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const COLUMNS: {
  status: ProjectStatus;
  label: string;
  tone: string;
  wipLimit?: number;
}[] = [
  { status: "PLANNING", label: "Planning", tone: "bg-slate-50 ring-slate-200" },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    tone: "bg-sky-50/70 ring-sky-200",
    wipLimit: 8,
  },
  { status: "BLOCKED", label: "Blocked", tone: "bg-red-50/60 ring-red-200" },
  {
    status: "ON_HOLD",
    label: "On Hold",
    tone: "bg-brand-tint/70 ring-orange-200",
  },
  {
    status: "COMPLETED",
    label: "Completed",
    tone: "bg-emerald-50/60 ring-emerald-200",
  },
];

/** Authorize rows before they reach either the visual board or the local CSV exporter. */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; owner?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const {
    scope: safeScope,
    owner,
    where,
  } = projectBoardFilters(session.user, await searchParams);

  const [projects, owners] = await Promise.all([
    db.project.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        coOwner: { select: { id: true, name: true } },
        members: { select: { id: true, name: true } },
      },
      orderBy: [
        { orderIndex: "asc" },
        { priority: "desc" },
        { targetDate: "asc" },
        { updatedAt: "desc" },
      ],
      take: 500,
    }),
    isManagerOrAbove(session.user.role)
      ? db.user.findMany({
          where: assignablePeopleWhere,
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="text-sm text-slate-500">
            Move work forward. Open a project to see its timeline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManagerOrAbove(session.user.role) && (
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
              <Link
                href="?scope=mine"
                className={`rounded px-3 py-1.5 ${safeScope === "mine" ? "border-2 border-brand-orange/50 bg-brand-tint text-brand-navy font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
              >
                Mine
              </Link>
              <Link
                href="?scope=all"
                className={`rounded px-3 py-1.5 ${safeScope === "all" ? "border-2 border-brand-orange/50 bg-brand-tint text-brand-navy font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="view-switch" aria-label="Project views">
          <Link href="/dashboard/projects">Cards</Link>
          <Link href="/dashboard/board" aria-current="page">
            Board
          </Link>
        </nav>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">How to move a project</summary>
          <p className="mt-2 max-w-lg">
            Drag a card’s move handle. With a keyboard, focus the handle, press
            Space to grab, use arrows to move, and Space to drop. Esc cancels.
          </p>
        </details>
      </div>
      <ProjectBoardClient
        columns={COLUMNS}
        initialProjects={projects.map((project) => ({
          ...project,
          canEdit: canEditProject({
            viewerId: session.user.id,
            viewerRole: session.user.role,
            ownerId: project.ownerId,
            coOwnerId: project.coOwnerId,
            memberIds: project.members.map((member) => member.id),
          }),
        }))}
        viewerId={session.user.id}
        canEditByOwner={isManagerOrAbove(session.user.role)}
      />
      <p className="text-xs text-neutral-400">
        The board and CSV show up to 500 matching projects. Managers can switch
        to all team work; members see projects they own, sub-own, or have
        joined. Archived projects are excluded.
      </p>
    </div>
  );
}

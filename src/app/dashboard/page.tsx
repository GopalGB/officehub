import Link from "next/link";
import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DueSoonWidget } from "@/components/dashboard/DueSoonWidget";
import { MyTasksWidget } from "@/components/dashboard/MyTasksWidget";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { q } = await searchParams;

  const where: Record<string, unknown> = {
    ownerId: session.user.id,
    status: { not: "ARCHIVED" },
  };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }

  const fourteenDays = new Date();
  fourteenDays.setDate(fourteenDays.getDate() + 14);

  const [mine, recentUpdates, recentComments, recentEnhancements, dueSoon, myTasks, favorites, counts] = await Promise.all([
    db.project.findMany({
      where,
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    db.projectUpdate.findMany({
      where: { project: { ownerId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { author: { select: { name: true } }, project: { select: { id: true, title: true } } },
    }),
    db.comment.findMany({
      where: { project: { ownerId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { author: { select: { name: true } }, project: { select: { id: true, title: true } } },
    }),
    db.enhancement.findMany({
      where: { project: { ownerId: session.user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { author: { select: { name: true } }, project: { select: { id: true, title: true } } },
    }),
    db.milestone.findMany({
      where: {
        project: { ownerId: session.user.id },
        completed: false,
        dueDate: { lte: fourteenDays },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { project: { select: { id: true, title: true } } },
    }),
    db.task.findMany({
      where: {
        assigneeId: session.user.id,
        status: { not: "DONE" },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 8,
      include: { project: { select: { id: true, title: true } } },
    }),
    db.project.findMany({
      where: {
        favoritedBy: { some: { id: session.user.id } },
        status: { not: "ARCHIVED" },
      },
      include: { owner: { select: { id: true, name: true } }, tags: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    db.project.groupBy({
      by: ["status"],
      where: { ownerId: session.user.id },
      _count: { status: true },
    }),
  ]);
  const favoriteIds = new Set(favorites.map((p) => p.id));

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.status]));
  const activity = [
    ...recentUpdates.map((u) => ({
      id: u.id,
      kind: "update" as const,
      projectId: u.project.id,
      projectTitle: u.project.title,
      authorName: u.author.name,
      summary: extractFirstLine(u.content),
      createdAt: u.createdAt,
    })),
    ...recentComments.map((c) => ({
      id: c.id,
      kind: "comment" as const,
      projectId: c.project.id,
      projectTitle: c.project.title,
      authorName: c.author.name,
      summary: c.content.slice(0, 120),
      createdAt: c.createdAt,
    })),
    ...recentEnhancements.map((e) => ({
      id: e.id,
      kind: "enhancement" as const,
      projectId: e.project.id,
      projectTitle: e.project.title,
      authorName: e.author.name,
      summary: e.title,
      createdAt: e.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {q ? `Search: "${q}"` : `Welcome back, ${session.user.name.split(" ")[0]}`}
          </h1>
          <p className="text-sm text-slate-500">
            {q ? `Your projects matching "${q}"` : "Your projects, statuses, and recent activity."}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">New project</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Planning", key: "PLANNING" },
          { label: "In Progress", key: "IN_PROGRESS" },
          { label: "Blocked", key: "BLOCKED" },
          { label: "On Hold", key: "ON_HOLD" },
          { label: "Completed", key: "COMPLETED" },
        ].map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold">{byStatus[s.key] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {favorites.length > 0 && !q && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <span className="text-black dark:text-white">★</span> Pinned
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map((p) => (
              <ProjectCard key={p.id} project={p} isFavorite />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {q ? "Matches" : "Your projects"}
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            title={q ? `No projects match "${q}"` : "No projects yet"}
            description={
              q
                ? "Try a different keyword, or jump back to the full list."
                : "Spin up your first project — set a title, target date, a quick description."
            }
            action={
              <Button asChild>
                <Link href={q ? "/dashboard" : "/dashboard/projects/new"}>
                  {q ? "Back to all projects" : "Create your first project"}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mine.map((p) => (
              <ProjectCard key={p.id} project={p} isFavorite={favoriteIds.has(p.id)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            My open tasks
          </h2>
          <Link href="/dashboard/tasks" className="text-xs font-medium text-slate-500 hover:underline">
            View all →
          </Link>
        </div>
        <MyTasksWidget
          items={myTasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            dueDate: t.dueDate,
            projectId: t.project.id,
            projectTitle: t.project.title,
          }))}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Due soon (next 14 days)
          </h2>
          <DueSoonWidget
            items={dueSoon
              .filter((m) => m.dueDate)
              .map((m) => ({
                id: m.id,
                title: m.title,
                dueDate: m.dueDate as Date,
                projectId: m.project.id,
                projectTitle: m.project.title,
              }))}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent activity
          </h2>
          <ActivityFeed items={activity} />
        </section>
      </div>
    </div>
  );
}

function extractFirstLine(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const blocks = content as Array<{ type?: string; content?: Array<{ text?: string }> }>;
  for (const b of blocks) {
    const text = b.content?.map((c) => c.text ?? "").join("") ?? "";
    if (text.trim()) return text.slice(0, 140);
  }
  return "";
}

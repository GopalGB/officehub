import Link from "next/link";
import { auth } from "../../../auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project/ProjectCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [mine, assignedRecent, counts] = await Promise.all([
    db.project.findMany({
      where: { ownerId: session.user.id, status: { not: "ARCHIVED" } },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
    db.projectUpdate.findMany({
      where: { authorId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { project: { select: { id: true, title: true } } },
    }),
    db.project.groupBy({
      by: ["status"],
      where: { ownerId: session.user.id },
      _count: { status: true },
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count.status]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {session.user.name.split(" ")[0]}</h1>
          <p className="text-sm text-slate-500">Your projects, statuses, and recent activity.</p>
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

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your projects</h2>
        {mine.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Spin up your first project — set a title, target date, and a quick description."
            action={
              <Button asChild>
                <Link href="/dashboard/projects/new">Create your first project</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mine.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      {assignedRecent.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your recent updates</h2>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {assignedRecent.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/dashboard/projects/${u.project.id}`} className="font-medium hover:underline">
                  {u.project.title}
                </Link>
                <span className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

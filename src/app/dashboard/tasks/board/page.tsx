import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { TaskKanbanCard } from "@/components/task/TaskKanbanCard";
import { Button } from "@/components/ui/button";

const COLUMNS: { status: TaskStatus; label: string; ring: string }[] = [
  { status: "TODO", label: "To Do", ring: "bg-slate-50 ring-slate-200" },
  { status: "IN_PROGRESS", label: "In Progress", ring: "bg-indigo-50 ring-indigo-200" },
  { status: "IN_REVIEW", label: "In Review", ring: "bg-amber-50 ring-amber-200" },
  { status: "BLOCKED", label: "Blocked", ring: "bg-rose-50 ring-rose-200" },
  { status: "DONE", label: "Done", ring: "bg-emerald-50 ring-emerald-200" },
];

export default async function TaskBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; project?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { scope = "mine", project } = await searchParams;

  const where: Record<string, unknown> = {};
  if (scope === "mine") where.assigneeId = session.user.id;
  if (scope === "all" && !isManagerOrAbove(session.user.role)) {
    where.assigneeId = session.user.id;
  }
  if (project && project !== "ALL") where.projectId = project;

  const [tasks, projects] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 500,
    }),
    db.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const byCol = COLUMNS.map((c) => ({ ...c, items: tasks.filter((t) => t.status === c.status) }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task board</h1>
          <p className="text-sm text-slate-500">
            Kanban for tasks. Click the status pill on a card to move it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
            <Link
              href={`?scope=mine${project ? `&project=${project}` : ""}`}
              className={`rounded px-3 py-1.5 ${scope === "mine" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Mine
            </Link>
            {isManagerOrAbove(session.user.role) && (
              <Link
                href={`?scope=all${project ? `&project=${project}` : ""}`}
                className={`rounded px-3 py-1.5 ${scope === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                All
              </Link>
            )}
          </div>
          <form method="get" className="inline-flex items-center gap-2">
            <input type="hidden" name="scope" value={scope} />
            <select
              name="project"
              defaultValue={project ?? "ALL"}
              onChange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
              className="h-8 rounded-md border border-slate-200 px-2 text-xs"
            >
              <option value="ALL">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </form>
          <Button asChild variant="outline">
            <Link href="/dashboard/tasks">← Table view</Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {byCol.map((col) => (
          <div key={col.status} className={`flex min-h-[400px] flex-col gap-2 rounded-md p-2 ring-1 ${col.ring}`}>
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {col.label}
              </h2>
              <span className="text-xs font-semibold text-slate-500">{col.items.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {col.items.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-slate-400">Empty</p>
              ) : (
                col.items.map((t) => {
                  const canEdit =
                    isManagerOrAbove(session.user.role) ||
                    t.reporterId === session.user.id ||
                    t.assigneeId === session.user.id;
                  return <TaskKanbanCard key={t.id} task={t} canEdit={canEdit} />;
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

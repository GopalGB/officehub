import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, projectAccessWhere, taskPermissions } from "@/lib/rbac";
import { TaskBoardClient } from "@/components/task/TaskBoardClient";
import { Button } from "@/components/ui/button";
import { taskFilters } from "@/lib/filters";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const COLUMNS: { status: TaskStatus; label: string; tone: string; wipLimit?: number }[] = [
  { status: "TODO", label: "To Do", tone: "bg-white ring-black/10" },
  { status: "IN_PROGRESS", label: "In Progress", tone: "bg-neutral-50 ring-black/15", wipLimit: 12 },
  { status: "IN_REVIEW", label: "In Review", tone: "bg-neutral-50 ring-black/15", wipLimit: 6 },
  { status: "BLOCKED", label: "Blocked", tone: "bg-white ring-black" },
  { status: "DONE", label: "Done", tone: "bg-neutral-50 ring-black/30" },
];

export default async function TaskBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; project?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const { project } = params;
  const { scope, where } = taskFilters(session.user, params);

  const [tasks, projects] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, title: true, ownerId: true, members: { select: { id: true } } } },
      },
      orderBy: [{ orderIndex: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      take: 500,
    }),
    db.project.findMany({
      where: { AND: [projectAccessWhere(session.user), { status: { not: "ARCHIVED" } }] },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task board</h1>
          <p className="text-sm text-slate-500">
            Drag a task across columns or reorder it within a column. Keyboard: Tab to focus, Space to grab, arrows to move, Space to drop, Esc to cancel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
            <Link
              href={`?scope=mine${project ? `&project=${project}` : ""}`}
              className={`rounded px-3 py-1.5 ${scope === "mine" ? "border-2 border-black bg-white text-black font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
            >
              Mine
            </Link>
            <Link href="?scope=projects" className="rounded px-3 py-1.5">My projects</Link>
            {isManagerOrAbove(session.user.role) && (
              <Link
                href={`?scope=all${project ? `&project=${project}` : ""}`}
                className={`rounded px-3 py-1.5 ${scope === "all" ? "border-2 border-black bg-white text-black font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
              >
                All
              </Link>
            )}
          </div>
          <form method="get" className="inline-flex items-center gap-2">
            <input type="hidden" name="scope" value={scope} />
            <AutoSubmitSelect
              name="project"
              defaultValue={project ?? "ALL"}
              options={[
                { value: "ALL", label: "All projects" },
                ...projects.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          </form>
          <Button asChild variant="outline">
            <Link href="/dashboard/tasks">← Table view</Link>
          </Button>
        </div>
      </header>

      <TaskBoardClient
        columns={COLUMNS}
        initialTasks={tasks.map((task) => ({ ...task, ...taskPermissions(session.user, task) }))}
        viewerId={session.user.id}
        isManagerOrAbove={isManagerOrAbove(session.user.role)}
      />
      <p className="text-xs text-neutral-400">
        Drag freely across columns or reorder within. Tasks you don&apos;t report or own show a lock icon.
      </p>
    </div>
  );
}

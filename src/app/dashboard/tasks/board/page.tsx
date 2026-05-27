import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { TaskBoardClient } from "@/components/task/TaskBoardClient";
import { Button } from "@/components/ui/button";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const COLUMNS: { status: TaskStatus; label: string; ring: string }[] = [
  { status: "TODO", label: "To Do", ring: "bg-slate-50 ring-slate-200" },
  { status: "IN_PROGRESS", label: "In Progress", ring: "bg-neutral-100 ring-black/15 dark:bg-neutral-900 dark:ring-white/15" },
  { status: "IN_REVIEW", label: "In Review", ring: "bg-neutral-50 ring-black/15 dark:bg-neutral-900 dark:ring-white/15" },
  { status: "BLOCKED", label: "Blocked", ring: "bg-white ring-black dark:bg-neutral-950 dark:ring-white" },
  { status: "DONE", label: "Done", ring: "bg-neutral-100 ring-black/30 dark:bg-white dark:ring-white" },
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
              className={`rounded px-3 py-1.5 ${scope === "mine" ? "border-2 border-black bg-white text-black font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
            >
              Mine
            </Link>
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
        initialTasks={tasks}
        viewerId={session.user.id}
        isManagerOrAbove={isManagerOrAbove(session.user.role)}
      />
      <p className="text-xs text-neutral-400">Drag any task to a new column to change its status.</p>
    </div>
  );
}

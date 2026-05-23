import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { TaskTable } from "@/components/task/TaskTable";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_OPTIONS } from "@/components/project/StatusBadge";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; status?: string; project?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { scope = "mine", status, project } = await searchParams;

  const where: Record<string, unknown> = {};
  if (scope === "mine") where.assigneeId = session.user.id;
  else if (scope === "reported") where.reporterId = session.user.id;
  // scope "all" — managers + admins only
  if (scope === "all" && !isManagerOrAbove(session.user.role)) {
    where.assigneeId = session.user.id;
  }
  if (status && status !== "ALL") where.status = status as TaskStatus;
  if (project && project !== "ALL") where.projectId = project;

  const [tasks, projects, members] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      take: 500,
    }),
    db.project.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-slate-500">
            Backlog and active work — table view. Inline status + assignee.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/tasks/board">Board view →</Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
        <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
          {(["mine", "reported", isManagerOrAbove(session.user.role) ? "all" : null] as const)
            .filter((v): v is "mine" | "reported" | "all" => v !== null)
            .map((s) => (
              <Link
                key={s}
                href={`?scope=${s}${status ? `&status=${status}` : ""}${project ? `&project=${project}` : ""}`}
                className={`rounded px-3 py-1.5 capitalize ${scope === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {s === "mine" ? "Assigned to me" : s === "reported" ? "Reported by me" : "All"}
              </Link>
            ))}
        </div>
        <form method="get" className="inline-flex items-center gap-2">
          <input type="hidden" name="scope" value={scope} />
          <select
            name="status"
            defaultValue={status ?? "ALL"}
            onChange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
            className="h-8 rounded-md border border-slate-200 px-2 text-xs"
          >
            <option value="ALL">All statuses</option>
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
      </div>

      <TaskTable
        rows={tasks}
        assignees={members}
        viewerId={session.user.id}
        canManage={isManagerOrAbove(session.user.role)}
        showProject
      />
    </div>
  );
}

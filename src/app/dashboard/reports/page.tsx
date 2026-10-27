import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import {
  isManagerOrAbove,
  projectAccessWhere,
  taskPermissions,
} from "@/lib/rbac";
import { TaskTable } from "@/components/task/TaskTable";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_OPTIONS } from "@/components/project/StatusBadge";
import { taskFilters } from "@/lib/filters";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; status?: string; project?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const { status, project } = params;
  const { scope, where } = taskFilters(session.user, params);

  const [tasks, projects, members] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            coOwnerId: true,
            members: { select: { id: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      take: 500,
    }),
    db.project.findMany({
      where: {
        AND: [
          projectAccessWhere(session.user),
          { status: { not: "ARCHIVED" } },
        ],
      },
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
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-slate-500">
            Project reports and deliverables. Open a report to edit its notes,
            link, owner, or deadline.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/reports/new">New report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/reports/board">Board view →</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
        <div className="inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
          {(
            [
              "mine",
              "reported",
              "projects",
              isManagerOrAbove(session.user.role) ? "all" : null,
            ] as const
          )
            .filter(
              (v): v is "mine" | "reported" | "projects" | "all" => v !== null,
            )
            .map((s) => (
              <Link
                key={s}
                href={`?scope=${s}${status ? `&status=${status}` : ""}${project ? `&project=${project}` : ""}`}
                className={`rounded px-3 py-1.5 capitalize ${scope === s ? "border-2 border-brand-orange/50 bg-brand-tint text-brand-navy font-semibold" : "text-neutral-700 hover:bg-neutral-100"}`}
              >
                {s === "mine"
                  ? "Assigned to me"
                  : s === "reported"
                    ? "Reported by me"
                    : s === "projects"
                      ? "My projects"
                      : "All"}
              </Link>
            ))}
        </div>
        <form method="get" className="inline-flex items-center gap-2">
          <input type="hidden" name="scope" value={scope} />
          <AutoSubmitSelect
            name="status"
            defaultValue={status ?? "ALL"}
            options={[
              { value: "ALL", label: "All statuses" },
              ...TASK_STATUS_OPTIONS,
            ]}
          />
          <AutoSubmitSelect
            name="project"
            defaultValue={project ?? "ALL"}
            options={[
              { value: "ALL", label: "All projects" },
              ...projects.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
        </form>
      </div>

      <TaskTable
        rows={tasks.map((task) => ({
          ...task,
          ...taskPermissions(session.user, task),
        }))}
        assignees={members}
        viewerId={session.user.id}
        canManage={isManagerOrAbove(session.user.role)}
        showProject
      />
    </div>
  );
}

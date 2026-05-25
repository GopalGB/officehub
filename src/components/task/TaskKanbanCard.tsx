import Link from "next/link";
import type { Task, User, Project } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/project/StatusBadge";
import { TaskStatusMenu } from "./TaskStatusMenu";
import { formatDate } from "@/lib/utils";

export function TaskKanbanCard({
  task,
  canEdit,
}: {
  task: Task & { assignee: Pick<User, "id" | "name"> | null; project?: Pick<Project, "id" | "title"> };
  canEdit: boolean;
}) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
  return (
    <div className="hover-lift rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400 hover:shadow-md">
      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
      {task.project && (
        <Link
          href={`/dashboard/projects/${task.project.id}`}
          className="mt-1 inline-block text-[10px] text-slate-500 hover:underline"
        >
          {task.project.title}
        </Link>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignee ? <Avatar name={task.assignee.name} size="sm" /> : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400">
              ?
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          {task.storyPoints != null && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
              {task.storyPoints}
            </span>
          )}
        </div>
        <TaskStatusMenu taskId={task.id} status={task.status} disabled={!canEdit} />
      </div>
      <div className="mt-1 text-[10px] text-slate-400">
        {task.dueDate ? (
          <span className={overdue ? "font-semibold text-black underline decoration-2 underline-offset-2 dark:text-white" : ""}>
            Due {formatDate(task.dueDate)}
            {overdue && " · overdue"}
          </span>
        ) : (
          "No due date"
        )}
      </div>
    </div>
  );
}

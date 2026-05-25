import Link from "next/link";
import type { Project, User } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "./StatusBadge";
import { QuickStatusMenu } from "./QuickStatusMenu";
import { formatDate, timeAgo } from "@/lib/utils";

export function KanbanCard({
  project,
  canEdit,
}: {
  project: Project & { owner: Pick<User, "id" | "name"> };
  canEdit: boolean;
}) {
  const overdue =
    project.targetDate &&
    new Date(project.targetDate) < new Date() &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);

  return (
    <div className="hover-lift group relative rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400 hover:shadow-md">
      <Link href={`/dashboard/projects/${project.id}`} className="block">
        <p className="line-clamp-2 pr-2 text-sm font-semibold text-slate-900">{project.title}</p>
        {project.summary && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.summary}</p>
        )}
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Avatar name={project.owner.name} size="sm" />
          <PriorityBadge priority={project.priority} />
        </div>
        <QuickStatusMenu projectId={project.id} status={project.status} canEdit={canEdit} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span className={overdue ? "font-semibold text-black underline decoration-2 underline-offset-2 dark:text-white" : ""}>
          {project.targetDate ? `Target ${formatDate(project.targetDate)}` : "No target date"}
          {overdue && " · overdue"}
        </span>
        <span>{timeAgo(project.updatedAt)}</span>
      </div>
    </div>
  );
}

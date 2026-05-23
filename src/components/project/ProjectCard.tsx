import Link from "next/link";
import type { Project, Tag, User } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, ProjectStatusBadge } from "./StatusBadge";
import { TagPills } from "./TagPills";
import { formatDate, timeAgo } from "@/lib/utils";

export function ProjectCard({
  project,
}: {
  project: Project & { owner: Pick<User, "id" | "name">; tags?: Tag[] };
}) {
  const overdue =
    project.targetDate &&
    new Date(project.targetDate) < new Date() &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);
  return (
    <Link href={`/dashboard/projects/${project.id}`} className="block">
      <Card className="h-full transition hover:border-slate-400 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{project.title}</CardTitle>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.summary && (
            <p className="line-clamp-2 text-sm text-slate-500">{project.summary}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-xs text-slate-500">
          {project.tags && project.tags.length > 0 && <TagPills tags={project.tags} />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar name={project.owner.name} size="sm" />
              <span>{project.owner.name}</span>
            </div>
            <PriorityBadge priority={project.priority} />
          </div>
          <div className="flex items-center justify-between">
            <span className={overdue ? "font-semibold text-rose-600" : ""}>
              {project.targetDate ? formatDate(project.targetDate) : "No target"}
              {overdue && " · overdue"}
            </span>
            <span>{timeAgo(project.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

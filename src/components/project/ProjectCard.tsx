import Link from "next/link";
import type { Project, Tag, User } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge, ProjectStatusBadge } from "./StatusBadge";
import { TagPills } from "./TagPills";
import { FavoriteButton } from "./FavoriteButton";
import { formatDate, isOverdueDate } from "@/lib/utils";

export function ProjectCard({
  project,
  isFavorite = false,
}: {
  project: Project & { owner: Pick<User, "id" | "name">; tags?: Tag[] };
  isFavorite?: boolean;
}) {
  const overdue =
    isOverdueDate(project.targetDate) &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);
  return (
    <Link href={`/dashboard/projects/${project.id}`} className="block min-w-0">
      <Card
        className={`hover-lift h-full border-t-[3px] hover:shadow-md ${project.status === "COMPLETED" ? "border-t-emerald-600" : project.status === "BLOCKED" ? "border-t-red-500" : project.status === "IN_PROGRESS" ? "border-t-brand-blue" : "border-t-brand-orange"}`}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="flex min-w-0 basis-full items-start gap-1 break-words text-base">
              <FavoriteButton
                projectId={project.id}
                initiallyFavorited={isFavorite}
                size="sm"
              />
              <span className="min-w-0 break-words">{project.title}</span>
            </CardTitle>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.summary && (
            <p className="line-clamp-2 text-sm text-slate-500">
              {project.summary}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-xs text-slate-500">
          {project.tags && project.tags.length > 0 && (
            <TagPills tags={project.tags} />
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar name={project.owner.name} size="sm" />
              <span>{project.owner.name}</span>
            </div>
            <PriorityBadge priority={project.priority} />
          </div>
          <div className="flex items-center justify-between">
            <span className={overdue ? "font-medium text-red-700" : ""}>
              {project.targetDate
                ? `Due ${formatDate(project.targetDate)}`
                : "Not scheduled"}
              {overdue && " · overdue"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

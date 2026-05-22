import Link from "next/link";
import type { Project, User } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, ProjectStatusBadge } from "./StatusBadge";
import { formatDate, timeAgo } from "@/lib/utils";

export function ProjectCard({
  project,
}: {
  project: Project & { owner: Pick<User, "id" | "name"> };
}) {
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
          <div className="flex items-center justify-between">
            <span>Owner: {project.owner.name}</span>
            <PriorityBadge priority={project.priority} />
          </div>
          <div className="flex items-center justify-between">
            <span>Target: {formatDate(project.targetDate)}</span>
            <span>Updated {timeAgo(project.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

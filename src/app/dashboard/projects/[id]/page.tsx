import Link from "next/link";
import { notFound } from "next/navigation";
import type { Block } from "@blocknote/core";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, ProjectStatusBadge } from "@/components/project/StatusBadge";
import { UpdateList } from "@/components/project/UpdateList";
import { EnhancementList } from "@/components/project/EnhancementList";
import { MilestoneList } from "@/components/project/MilestoneList";
import { CommentThread } from "@/components/project/CommentThread";
import { TagPicker } from "@/components/project/TagPicker";
import { TaskQuickAdd } from "@/components/task/TaskQuickAdd";
import { TaskTable } from "@/components/task/TaskTable";
import { BlockReader } from "@/components/editor/BlockReader";
import {
  addComment,
  addEnhancement,
  addMilestone,
  addProjectUpdate,
  deleteComment,
  deleteEnhancement,
  deleteMilestone,
  deleteProject,
  toggleMilestone,
  updateEnhancement,
} from "@/app/dashboard/actions";
import { canEditProject, canDeleteProject } from "@/lib/rbac";
import { formatDate, timeAgo } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const [project, allTags, members] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tags: true,
        tasks: {
          include: {
            assignee: { select: { id: true, name: true } },
            reporter: { select: { id: true, name: true } },
          },
          orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { orderIndex: "asc" }],
        },
        updates: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        enhancements: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        milestones: { orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { orderIndex: "asc" }] },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!project) notFound();

  const canEdit = canEditProject({
    viewerRole: session.user.role,
    viewerId: session.user.id,
    ownerId: project.ownerId,
  });
  const canDelete = canDeleteProject({
    viewerRole: session.user.role,
    viewerId: session.user.id,
    ownerId: project.ownerId,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            {project.summary && <p className="text-sm text-slate-500">{project.summary}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/projects/${project.id}/edit`}>Edit</Link>
              </Button>
            )}
            {canDelete && (
              <form
                action={async () => {
                  "use server";
                  await deleteProject(project.id);
                }}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Delete
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <span className="flex items-center gap-2">
            <Avatar name={project.owner.name} className="h-6 w-6 text-[10px]" />
            Owner: <strong className="text-slate-700">{project.owner.name}</strong>
          </span>
          <span>Starts: {formatDate(project.startDate)}</span>
          <span>Target: {formatDate(project.targetDate)}</span>
          <span>Updated {timeAgo(project.updatedAt)}</span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <TagPicker
            projectId={project.id}
            allTags={allTags}
            selectedIds={project.tags.map((t) => t.id)}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockReader content={(project.description as Block[] | null) ?? null} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Tasks <span className="text-xs font-normal text-slate-400">({project.tasks.length})</span>
          </h2>
          <TaskQuickAdd projectId={project.id} assignees={members} />
        </div>
        <TaskTable
          rows={project.tasks}
          assignees={members}
          viewerId={session.user.id}
          canManage={canEdit}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Milestones</h2>
        <MilestoneList
          projectId={project.id}
          items={project.milestones}
          onAdd={addMilestone}
          onToggle={toggleMilestone}
          onDelete={deleteMilestone}
          canManage={canEdit}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Status updates</h2>
        <UpdateList
          updates={project.updates.map((u) => ({
            id: u.id,
            content: u.content as Block[] | null,
            createdAt: u.createdAt,
            author: u.author,
          }))}
          onAdd={addProjectUpdate.bind(null, project.id)}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Enhancements</h2>
        <EnhancementList
          projectId={project.id}
          items={project.enhancements}
          onAdd={addEnhancement}
          onUpdate={updateEnhancement}
          onDelete={deleteEnhancement}
          viewerId={session.user.id}
          canManage={canEdit}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Comments</h2>
        <CommentThread
          projectId={project.id}
          items={project.comments}
          viewerId={session.user.id}
          canManage={canEdit}
          onAdd={addComment}
          onDelete={deleteComment}
        />
      </section>
    </div>
  );
}

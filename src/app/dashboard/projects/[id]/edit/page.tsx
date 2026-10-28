import { assignablePeopleWhere } from "@/lib/project-people";
import { notFound, redirect } from "next/navigation";
import type { Block } from "@blocknote/core";
import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/project/ProjectForm";
import { updateProject } from "@/app/dashboard/actions";
import {
  canEditProject,
  projectAccessWhere,
  isManagerOrAbove,
} from "@/lib/rbac";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({
    where: { id, AND: [projectAccessWhere(session.user)] },
    include: { members: { select: { id: true } } },
  });
  if (!project) notFound();
  if (
    !canEditProject({
      viewerRole: session.user.role,
      viewerId: session.user.id,
      ownerId: project.ownerId,
      coOwnerId: project.coOwnerId,
      memberIds: project.members.map((m) => m.id),
    })
  ) {
    redirect(`/dashboard/projects/${id}`);
  }

  const [people, projects] = await Promise.all([
    db.user.findMany({
      where: assignablePeopleWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: { id: { not: id }, AND: [projectAccessWhere(session.user)] },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  async function action(formData: FormData) {
    "use server";
    await updateProject(id, formData);
    redirect(`/dashboard/projects/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit project</h1>
        <p className="text-sm text-slate-500">
          Adjust details, status, or timeline.
        </p>
      </header>
      <ProjectForm
        action={action}
        people={people}
        projects={projects}
        canChangeOwner={
          project.ownerId === session.user.id ||
          isManagerOrAbove(session.user.role)
        }
        submitLabel="Save changes"
        initial={{
          ...project,
          title: project.title,
          summary: project.summary,
          description: (project.description as Block[] | null) ?? null,
          status: project.status,
          priority: project.priority,
          startDate: project.startDate,
          targetDate: project.targetDate,
        }}
      />
    </div>
  );
}

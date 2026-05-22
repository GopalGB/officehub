import { notFound, redirect } from "next/navigation";
import type { Block } from "@blocknote/core";
import { auth } from "../../../../../../auth";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/project/ProjectForm";
import { updateProject } from "@/app/dashboard/actions";
import { canEditProject } from "@/lib/rbac";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();
  if (!canEditProject({ viewerRole: session.user.role, viewerId: session.user.id, ownerId: project.ownerId })) {
    redirect(`/dashboard/projects/${id}`);
  }

  async function action(formData: FormData) {
    "use server";
    await updateProject(id, formData);
    redirect(`/dashboard/projects/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Edit project</h1>
        <p className="text-sm text-slate-500">Adjust details, status, or timeline.</p>
      </header>
      <ProjectForm
        action={action}
        submitLabel="Save changes"
        initial={{
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

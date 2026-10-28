import { assignablePeopleWhere } from "@/lib/project-people";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { projectAccessWhere, isManagerOrAbove } from "@/lib/rbac";
import { createProject } from "@/app/dashboard/actions";
import { ProjectForm } from "@/components/project/ProjectForm";
export default async function NewProjectPage() {
  const session = await auth();
  if (!session?.user) return null;
  const [people, projects] = await Promise.all([
    db.user.findMany({
      where: assignablePeopleWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({
      where: projectAccessWhere(session.user),
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Projects / Create</p>
        <h1 className="page-title">Start a project</h1>
        <p className="page-subtitle">
          Define ownership, the outcome, and the delivery date. Add detail as
          work progresses.
        </p>
      </header>
      <div className="surface">
        <ProjectForm
          action={createProject}
          people={people}
          projects={projects}
          canChangeOwner
          ownerSelectable={isManagerOrAbove(session.user.role)}
          currentUserId={session.user.id}
          submitLabel="Create project"
        />
        {!isManagerOrAbove(session.user.role) && (
          <p className="mt-3 text-xs text-muted-foreground">
            You will own this project. A manager can transfer it later.
          </p>
        )}
      </div>
    </div>
  );
}

import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { projectAccessWhere } from "@/lib/rbac";
import { ActionForm } from "@/components/ui/action-form";
import { ReportFields } from "@/components/task/ReportFields";
import { createReport } from "@/app/dashboard/actions";
export default async function NewReport() {
  const session = await auth();
  if (!session?.user) return null;
  const [projects, people] = await Promise.all([
    db.project.findMany({
      where: projectAccessWhere(session.user),
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Reports / Create</p>
        <h1 className="page-title">New report</h1>
        <p className="page-subtitle">
          Keep the deliverable, its document link, and its progress together.
        </p>
      </header>
      <section className="surface">
        {projects.length ? (
          <ActionForm
            action={createReport}
            label="Create report"
            successMessage="Report created. Open Reports to view it."
          >
            <label className="field">
              Project
              <select name="projectId" required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <ReportFields people={people} />
          </ActionForm>
        ) : (
          <p className="text-sm text-muted-foreground">
            Create a project first, or ask its owner to add you.
          </p>
        )}
      </section>
    </div>
  );
}

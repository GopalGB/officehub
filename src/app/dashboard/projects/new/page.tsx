import { createProject } from "@/app/dashboard/actions";
import { ProjectForm } from "@/components/project/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="text-sm text-slate-500">
          Set up the basics — you can add milestones, enhancements, and updates after.
        </p>
      </header>
      <ProjectForm action={createProject} submitLabel="Create project" />
    </div>
  );
}

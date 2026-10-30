import { auth } from "../../../../../auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { assignablePeopleWhere } from "@/lib/project-people";
import { ProjectImportForm } from "@/components/project/ProjectImportForm";

export default async function ProjectImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isManagerOrAbove(session.user.role)) redirect("/dashboard/projects");
  const people = await db.user.findMany({
    where: assignablePeopleWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Projects / Import</p>
        <h1 className="page-title">Bring your projects from Excel</h1>
        <p className="page-subtitle">
          Upload once, review the details, and keep every project’s changes
          together.
        </p>
      </header>
      <ProjectImportForm people={people} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { taskPermissions, projectAccessWhere } from "@/lib/rbac";
import { updateTask } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ReportFields } from "@/components/task/ReportFields";
import { formatDate } from "@/lib/utils";
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const report = await db.task.findUnique({
    where: {
      id,
      OR: [
        { assigneeId: session.user.id },
        { reporterId: session.user.id },
        { project: projectAccessWhere(session.user) },
      ],
    },
    include: {
      project: { include: { members: { select: { id: true } } } },
      assignee: { select: { name: true } },
    },
  });
  if (!report) notFound();
  const permissions = taskPermissions(session.user, report);
  const canEdit = permissions.canEdit;
  const people = await db.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">
          <Link href="/dashboard/reports">Reports</Link> /{" "}
          {report.project.title}
        </p>
        <h1 className="page-title">{report.title}</h1>
        <p className="page-subtitle">
          {report.assignee?.name ?? "Unassigned"} · Due{" "}
          {formatDate(report.dueDate)}
        </p>
      </header>
      <section className="surface">
        {canEdit ? (
          <ActionForm
            action={updateTask.bind(null, id)}
            successMessage="Report saved."
          >
            <ReportFields report={report} people={people} canAssign={permissions.canAssign} />
          </ActionForm>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm">{report.description}</p>
            {report.reportUrl && (
              <a
                className="text-link mt-4 block"
                href={report.reportUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open report document
              </a>
            )}
          </>
        )}
      </section>
    </div>
  );
}

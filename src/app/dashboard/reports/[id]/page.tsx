import { assignablePeopleWhere } from "@/lib/project-people";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { taskPermissions, reportAccessWhere } from "@/lib/rbac";
import {
  updateTask,
  createReminder,
  completeReminder,
  deleteReminder,
} from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { ReportFields } from "@/components/task/ReportFields";
import { TaskStatusBadge, TASK_STATUS_LABEL } from "@/components/project/StatusBadge";
import { listBrandNames } from "@/lib/brands";
import { REPEAT_OPTIONS } from "@/lib/reminders";
import { reportKindLabel } from "@/lib/report-kinds";
import { dateKey, localToday } from "@/lib/fiscal";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { TaskStatus } from "@prisma/client";

function statusOf(snapshot: unknown): TaskStatus | null {
  if (!snapshot || typeof snapshot !== "object" || !("status" in snapshot)) return null;
  const { status } = snapshot;
  return typeof status === "string" && status in TASK_STATUS_LABEL ? (status as TaskStatus) : null;
}

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
      AND: [reportAccessWhere(session.user)],
    },
    include: {
      project: { include: { members: { select: { id: true } } } },
      assignee: { select: { name: true } },
      brand: { select: { name: true } },
    },
  });
  if (!report) notFound();
  const permissions = taskPermissions(session.user, report);
  const canEdit = permissions.canEdit;
  const [people, brands, events, reminders] = await Promise.all([
    db.user.findMany({
      where: assignablePeopleWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listBrandNames(db),
    db.auditLog.findMany({
      where: { entity: "Report", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.reminder.findMany({
      where: { taskId: id, userId: session.user.id, doneAt: null },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  // Status journey from the audit trail: one row per real status change.
  const journey = events
    .map((e) => {
      const meta = (e.meta ?? {}) as { actor?: string; before?: unknown; after?: unknown };
      return {
        id: e.id,
        at: e.createdAt,
        actor: meta.actor ?? "Someone",
        from: statusOf(meta.before),
        to: statusOf(meta.after),
      };
    })
    .filter((e) => e.to && e.from !== e.to);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">
          <Link href="/dashboard/reports">Reports</Link> /{" "}
          <Link href={`/dashboard/projects/${report.projectId}`}>{report.project.title}</Link>
        </p>
        <h1 className="page-title">{report.title}</h1>
        <p className="page-subtitle flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={report.status} />
          <span>{reportKindLabel(report.kind)}</span>
          {report.brand && <span className="pill">{report.brand.name}</span>}
          <span>
            {report.assignee?.name ?? "Unassigned"} · Due {formatDate(report.dueDate)}
          </span>
        </p>
        {report.statusNote && (
          <p className="mt-2 rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-navy">{report.statusNote}</p>
        )}
      </header>
      <section className="surface">
        {canEdit ? (
          <ActionForm action={updateTask.bind(null, id)} successMessage="Report saved.">
            <ReportFields
              report={report}
              people={people}
              brands={brands}
              brandName={report.brand?.name}
              canAssign={permissions.canAssign}
              currentAssigneeName={report.assignee?.name}
            />
          </ActionForm>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm">{report.description}</p>
            {report.reportUrl && (
              <a className="text-link mt-4 block" href={report.reportUrl} target="_blank" rel="noreferrer">
                Open report document
              </a>
            )}
          </>
        )}
      </section>

      <section className="surface space-y-4">
        <div>
          <h2 className="section-title">Remind me</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reminders appear on your workspace and in Reminders. Use a repeat for weekly or monthly reports.
          </p>
        </div>
        {reminders.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span>
              <strong>{r.title}</strong> · {formatDate(r.dueAt)}
              {r.repeat !== "NONE" && ` · ${REPEAT_OPTIONS.find((o) => o.value === r.repeat)?.label}`}
            </span>
            <span className="flex gap-2">
              <ActionForm action={completeReminder.bind(null, r.id)} label={r.repeat === "NONE" ? "Done" : "Done, next"} className="" />
              <ActionForm action={deleteReminder.bind(null, r.id)} label="Remove" className="" />
            </span>
          </div>
        ))}
        <ActionForm action={createReminder} label="Add reminder" successMessage="Reminder added." className="grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end">
          <input type="hidden" name="taskId" value={id} />
          <label className="field">
            What to remember
            <input name="title" required minLength={2} maxLength={200} defaultValue={`Send ${report.title}`} />
          </label>
          <label className="field">
            On
            <input name="dueAt" type="date" required defaultValue={report.dueDate ? dateKey(report.dueDate) : dateKey(localToday())} />
          </label>
          <label className="field">
            Repeat
            <select name="repeat" defaultValue="NONE">
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </section>

      <details className="disclosure" open={journey.length > 0 && journey.length < 6}>
        <summary>Status history · {journey.length}</summary>
        <div className="disclosure-body">
          <ol className="space-y-3">
            {journey.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{formatDateTime(e.at)}</span>
                {e.from && <TaskStatusBadge status={e.from} />}
                {e.from && <span aria-hidden="true">→</span>}
                {e.to && <TaskStatusBadge status={e.to} />}
                <span className="text-muted-foreground">by {e.actor}</span>
              </li>
            ))}
            {!journey.length && <li className="text-sm text-muted-foreground">No status changes yet.</li>}
          </ol>
        </div>
      </details>
    </div>
  );
}

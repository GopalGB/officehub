import Link from "next/link";
import type { AuditLog, ProjectRevision } from "@prisma/client";
import { formatDateTime } from "@/lib/utils";
import { restoreProjectRevision } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
const labels: Record<string, string> = {
  title: "Title",
  summary: "Summary",
  description: "Description",
  status: "Status",
  priority: "Priority",
  date: "Work date",
  weekStart: "Week beginning",
  startDate: "Start date",
  targetDate: "Deadline",
  actualEndDate: "Completed on",
  ownerId: "Owner",
  coOwnerId: "Sub-owner",
  projectType: "Project type",
  sourceProjectId: "Source project",
  estimatedHours: "Estimated hours",
  savedHours: "Hours saved / week",
  acceptanceCriteria: "Success criteria",
  department: "Department",
  completed: "Completed",
  completedAt: "Completed on",
  dueDate: "Due date",
  reportUrl: "Report link",
  assigneeId: "Assigned to",
  releaseLabel: "Release",
  content: "Content",
  members: "Collaborators",
  tags: "Tags",
  weekdays: "Days",
  hours: "Hours",
  startTime: "Start time",
  skipped: "Skipped",
  note: "Reason",
};
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function richText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value))
    return value.map(richText).filter(Boolean).join(" ");
  const item = object(value);
  return typeof item.text === "string"
    ? item.text
    : [richText(item.content), richText(item.children)]
        .filter(Boolean)
        .join(" ");
}
function display(value: unknown, names: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string")
    return (
      names[value] ??
      (/^\d{4}-\d\d-\d\dT/.test(value) ? formatDateTime(value) : value)
    );
  if (
    Array.isArray(value) &&
    value.some((v) => typeof object(v).type === "string")
  ) {
    const text = richText(value);
    return text.length > 2000
      ? text.slice(0, 2000) + "…"
      : text || "Empty content";
  }
  if (Array.isArray(value))
    return (
      value
        .map((v) =>
          typeof v === "object"
            ? display(object(v).id ?? object(v).name ?? "Rich content", names)
            : String(v),
        )
        .join(", ") || "—"
    );
  return "Rich content updated";
}
export function ProjectHistory({
  projectId,
  version,
  revisions,
  events,
  names,
  canRestore,
  page = 1,
  pages = 1,
}: {
  projectId: string;
  version: number;
  revisions: ProjectRevision[];
  events: AuditLog[];
  names: Record<string, string>;
  canRestore: boolean;
  page?: number;
  pages?: number;
}) {
  return (
    <div className="space-y-6">
      <section className="surface">
        <h2 className="section-title">Saved project versions</h2>
        <p className="page-subtitle">
          Compare previous details. Restoring creates a new version and keeps
          later history. Reports, enhancements, and daily plans have their own
          change history below.
        </p>
        <div className="mt-5 divide-y">
          {revisions.map((r) => (
            <details key={r.id} className="py-4">
              <summary className="cursor-pointer text-sm">
                <strong>Version {r.version}</strong> · {r.reason}
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.authorName} · {formatDateTime(r.createdAt)}
                </span>
              </summary>
              <dl className="my-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(object(r.snapshot))
                  .filter(([key]) => key in labels)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-muted-foreground">
                        {labels[key]}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                        {display(value, names)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {canRestore && r.version !== version && (
                <ActionForm
                  action={restoreProjectRevision.bind(null, projectId)}
                  label={`Restore details from v${r.version}`}
                  successMessage="Project details restored as a new version."
                >
                  <input type="hidden" name="revisionId" value={r.id} />
                  <input type="hidden" name="expectedVersion" value={version} />
                </ActionForm>
              )}
            </details>
          ))}
          {!revisions.length && (
            <p className="py-4 text-sm text-muted-foreground">
              The current details will be saved as a baseline on the next
              change. Earlier updates remain below.
            </p>
          )}
        </div>
      </section>
      <section className="surface">
        <h2 className="section-title">Change history</h2>
        <p className="page-subtitle">
          Who changed what and when. History starts when this version of the
          workspace is installed.
        </p>
        <ol className="mt-5 divide-y">
          {events.map((e) => {
            const meta = object(e.meta),
              before = object(meta.before),
              after = object(meta.after);
            const changes = Object.keys(labels).filter(
              (key) =>
                (key in before || key in after) &&
                JSON.stringify(before[key]) !== JSON.stringify(after[key]),
            );
            return (
              <li key={e.id} className="py-4">
                <p className="text-sm font-medium">{e.action}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {typeof meta.actor === "string"
                    ? meta.actor
                    : (names[e.userId ?? ""] ?? "Workspace")}{" "}
                  · {formatDateTime(e.createdAt)}
                </p>
                {changes.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-brand-link">
                      View {changes.length} changed field
                      {changes.length === 1 ? "" : "s"}
                    </summary>
                    <dl className="mt-3 space-y-2 text-xs">
                      {changes.map((key) => (
                        <div key={key} className="rounded-md bg-secondary p-3">
                          <dt className="font-medium">{labels[key]}</dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                            {display(before[key], names)} →{" "}
                            {display(after[key], names)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
          {!events.length && (
            <li className="py-4 text-sm text-muted-foreground">
              New changes will appear here automatically.
            </li>
          )}
        </ol>
      </section>
      {pages > 1 && (
        <nav
          className="flex justify-between text-sm"
          aria-label="History pages"
        >
          {page > 1 ? (
            <Link className="text-link" href={`?tab=history&hpage=${page - 1}`}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            History page {page} of {pages}
          </span>
          {page < pages && (
            <Link className="text-link" href={`?tab=history&hpage=${page + 1}`}>
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

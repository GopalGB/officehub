"use client";
import { useTransition } from "react";
import type { Milestone } from "@prisma/client";
import { ActionForm } from "@/components/ui/action-form";
import { updateMilestone } from "@/app/dashboard/actions";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
export function MilestoneList({
  projectId,
  items,
  onAdd,
  onToggle,
  onDelete,
  canManage,
}: {
  projectId: string;
  items: Milestone[];
  onAdd: (projectId: string, fd: FormData) => Promise<void>;
  onToggle: (
    id: string,
    projectId: string,
    completed: boolean,
  ) => Promise<void>;
  onDelete: (id: string, projectId: string) => Promise<void>;
  canManage: boolean;
}) {
  const [pending, start] = useTransition(),
    { toast } = useToast();
  return (
    <div className="space-y-4">
      {canManage && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            + Add milestone
          </summary>
          <div className="mt-4">
            <ActionForm
              action={onAdd.bind(null, projectId)}
              label="Add milestone"
              successMessage="Milestone added."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">
                  Milestone
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="e.g. Leadership sign-off"
                  />
                </label>
                <label className="field">
                  Deadline
                  <input name="dueDate" type="date" />
                </label>
              </div>
            </ActionForm>
          </div>
        </details>
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {items.map((m) => (
          <li key={m.id} className="px-4 py-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label={`Complete milestone: ${m.title}`}
                checked={m.completed}
                disabled={!canManage || pending}
                onChange={(e) => {
                  const completed = e.target.checked;
                  start(async () => {
                    try {
                      await onToggle(m.id, projectId, completed);
                    } catch (cause) {
                      toast(
                        cause instanceof Error
                          ? cause.message
                          : "Could not update milestone",
                        "error",
                      );
                    }
                  });
                }}
                className="h-4 w-4 rounded border-slate-300 accent-brand-navy"
              />
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${m.completed ? "text-muted-foreground line-through" : ""}`}
                >
                  {m.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Due {formatDate(m.dueDate)}
                  {m.completedAt
                    ? ` · Completed ${formatDate(m.completedAt)}`
                    : ""}
                </p>
              </div>
            </div>
            {canManage && (
              <details className="ml-7 mt-3">
                <summary className="cursor-pointer text-xs text-brand-link">
                  Edit deadline or title
                </summary>
                <div className="mt-3">
                  <ActionForm
                    action={updateMilestone.bind(null, m.id, projectId)}
                    successMessage="Milestone updated."
                  >
                    <label className="field">
                      Title
                      <input
                        name="title"
                        defaultValue={m.title}
                        required
                        minLength={2}
                        maxLength={160}
                      />
                    </label>
                    <label className="field">
                      Deadline
                      <input
                        name="dueDate"
                        type="date"
                        defaultValue={
                          m.dueDate
                            ? new Date(m.dueDate).toISOString().slice(0, 10)
                            : ""
                        }
                      />
                    </label>
                  </ActionForm>
                  <ActionForm
                    className="mt-3"
                    action={onDelete.bind(null, m.id, projectId)}
                    label="Remove milestone"
                  />
                </div>
              </details>
            )}
          </li>
        ))}
        {!items.length && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No milestones yet.
          </li>
        )}
      </ul>
    </div>
  );
}

"use client";
import type { Enhancement, User } from "@prisma/client";
import { ActionForm } from "@/components/ui/action-form";
import {
  ENHANCEMENT_STATUS_OPTIONS,
  EnhancementStatusBadge,
  PRIORITY_OPTIONS,
} from "./StatusBadge";
import { formatDate } from "@/lib/utils";
type Item = Enhancement & { author: Pick<User, "id" | "name"> };
function Fields({ item }: { item?: Item }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {item && (
        <input type="hidden" name="expectedVersion" value={item.version} />
      )}
      <label className="field sm:col-span-2">
        Enhancement title
        <input
          name="title"
          required
          minLength={2}
          maxLength={160}
          defaultValue={item?.title}
          placeholder="What changes in this release?"
        />
      </label>
      <label className="field">
        Release / version label
        <input
          name="releaseLabel"
          maxLength={50}
          defaultValue={item?.releaseLabel ?? ""}
          placeholder="e.g. v1.1 or Phase 2"
        />
      </label>
      <label className="field">
        Status
        <select name="status" defaultValue={item?.status ?? "PROPOSED"}>
          {ENHANCEMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Start date
        <input
          name="startDate"
          type="date"
          defaultValue={
            item?.startDate
              ? new Date(item.startDate).toISOString().slice(0, 10)
              : ""
          }
        />
      </label>
      <label className="field">
        Delivery deadline
        <input
          name="targetDate"
          type="date"
          defaultValue={
            item?.targetDate
              ? new Date(item.targetDate).toISOString().slice(0, 10)
              : ""
          }
        />
      </label>
      <label className="field">
        Estimated effort (hours)
        <input
          name="estimatedHours"
          type="number"
          min="0"
          max="100000"
          step="0.25"
          defaultValue={item?.estimatedHours ?? ""}
        />
      </label>
      <label className="field">
        Time saved (hours / week)
        <input
          name="savedHours"
          type="number"
          min="0"
          max="100000"
          step="0.25"
          defaultValue={item?.savedHours ?? ""}
        />
      </label>
      <label className="field">
        Priority
        <select name="priority" defaultValue={item?.priority ?? "MEDIUM"}>
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field sm:col-span-2">
        Scope and reason
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={item?.description ?? ""}
        />
      </label>
    </div>
  );
}
export function EnhancementList({
  projectId,
  items,
  onAdd,
  onUpdate,
  onDelete,
  canManage,
}: {
  projectId: string;
  items: Item[];
  onAdd: (projectId: string, fd: FormData) => Promise<void>;
  onUpdate: (id: string, projectId: string, fd: FormData) => Promise<void>;
  onDelete: (id: string, projectId: string) => Promise<void>;
  viewerId: string;
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add improvements during or after delivery. Each keeps its own scope,
        dates, release label, and change history.
      </p>
      {canManage && (
        <details className="surface">
          <summary className="cursor-pointer text-sm font-semibold">
            + Add an enhancement
          </summary>
          <div className="mt-5">
            <ActionForm
              action={onAdd.bind(null, projectId)}
              label="Add enhancement"
              successMessage="Enhancement added to the project journey."
            >
              <Fields />
            </ActionForm>
          </div>
        </details>
      )}
      {items.map((item) => (
        <article key={item.id} className="surface">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">
                  {item.releaseLabel && (
                    <span className="mr-2 text-brand-link">
                      {item.releaseLabel}
                    </span>
                  )}
                  {item.title}
                </h3>
                <EnhancementStatusBadge status={item.status} />
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {item.description}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatDate(item.startDate)} → {formatDate(item.targetDate)} ·{" "}
                {item.estimatedHours ?? "—"} estimated hours ·{" "}
                {item.savedHours ?? "—"} hours saved / week
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Added by {item.author.name} · Version {item.version}
                {item.completedAt
                  ? ` · Completed ${formatDate(item.completedAt)}`
                  : ""}
              </p>
            </div>
          </div>
          {canManage && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-brand-link">
                Edit enhancement
              </summary>
              <div className="mt-4">
                <ActionForm
                  action={onUpdate.bind(null, item.id, projectId)}
                  successMessage="Enhancement updated."
                >
                  <Fields item={item} />
                </ActionForm>
                <button
                  type="button"
                  className="mt-4 text-xs text-red-700 dark:text-red-300"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete enhancement “${item.title}”? Its change history will remain.`,
                      )
                    )
                      void onDelete(item.id, projectId);
                  }}
                >
                  Delete enhancement
                </button>
              </div>
            </details>
          )}
        </article>
      ))}
      {!items.length && (
        <div className="surface text-center text-sm text-muted-foreground">
          No enhancements yet. The original delivery remains visible in
          Overview.
        </div>
      )}
    </div>
  );
}

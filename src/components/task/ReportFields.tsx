import type { Task } from "@prisma/client";
import {
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/components/project/StatusBadge";
export function ReportFields({
  report,
  people,
  canAssign = true,
}: {
  canAssign?: boolean;
  report?: Task;
  people: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {report && (
        <input type="hidden" name="expectedVersion" value={report.version} />
      )}
      <label className="field sm:col-span-2">
        Report title
        <input
          name="title"
          minLength={1}
          maxLength={200}
          defaultValue={report?.title}
          required
        />
      </label>
      <label className="field">
        Owner
        <select
          disabled={!canAssign}
          name="assigneeId"
          defaultValue={report?.assigneeId ?? ""}
        >
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Status
        <select name="status" defaultValue={report?.status ?? "TODO"}>
          {TASK_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Deadline
        <input
          name="dueDate"
          type="date"
          defaultValue={report?.dueDate?.toISOString().slice(0, 10)}
        />
      </label>
      <label className="field">
        Estimated hours
        <input
          name="estimatedHours"
          type="number"
          step="0.25"
          min="0"
          max="100000"
          defaultValue={report?.estimatedHours ?? ""}
        />
      </label>
      <label className="field">
        Priority
        <select name="priority" defaultValue={report?.priority ?? "MEDIUM"}>
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field sm:col-span-2">
        Report / document link
        <input
          name="reportUrl"
          type="url"
          maxLength={2000}
          defaultValue={report?.reportUrl ?? ""}
          placeholder="https://…"
        />
      </label>
      <label className="field sm:col-span-2">
        Notes and delivery details
        <textarea
          name="description"
          rows={6}
          maxLength={2000}
          defaultValue={report?.description ?? ""}
        />
      </label>
    </div>
  );
}

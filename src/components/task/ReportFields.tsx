import type { Task } from "@prisma/client";
import { REPORT_KINDS } from "@/lib/report-kinds";
import { FREE_PERSON } from "@/lib/free-person";
import { SmartSuggest } from "@/components/common/SmartSuggest";
import { KEEP_ASSIGNMENT } from "@/lib/allocation-form";
import {
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/components/project/StatusBadge";
export function ReportFields({
  report,
  people,
  canAssign = true,
  currentAssigneeName,
  brands = [],
  brandName,
}: {
  brands?: string[];
  brandName?: string | null;
  canAssign?: boolean;
  currentAssigneeName?: string;
  report?: Task;
  people: { id: string; name: string }[];
}) {
  const keepAssignee =
    !!report?.assigneeId &&
    !people.some((person) => person.id === report.assigneeId);
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
      <SmartSuggest kind="report" excludeId={report?.id} />
      <label className="field">
        Type
        <select name="kind" defaultValue={report?.kind ?? "REPORT"}>
          {REPORT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Brand
        <input
          name="brand"
          list="report-brand-options"
          maxLength={60}
          placeholder="Type or pick a brand"
          defaultValue={brandName ?? ""}
        />
        <datalist id="report-brand-options">
          {brands.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="field">
        Owner
        <select
          disabled={!canAssign}
          name="assigneeId"
          defaultValue={
            keepAssignee ? KEEP_ASSIGNMENT : (report?.assigneeId ?? "")
          }
        >
          <option value="">Unassigned</option>
          {!report && <option value={FREE_PERSON}>Whoever is free (automatic)</option>}
          {keepAssignee && (
            <option value={KEEP_ASSIGNMENT}>Keep current assignment</option>
          )}
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {keepAssignee && (
          <span className="text-xs font-normal text-muted-foreground">
            Current assignment: {currentAssigneeName ?? "Existing account"}.
            Choose a team member to reassign.
          </span>
        )}
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
        Hours saved per week
        <input
          name="savedHours"
          type="number"
          step="0.25"
          min="0"
          max="100000"
          defaultValue={report?.savedHours ?? ""}
          placeholder="e.g. 2"
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
        Current status note
        <input
          name="statusNote"
          maxLength={500}
          defaultValue={report?.statusNote ?? ""}
          placeholder="e.g. Waiting for Aero data refresh"
        />
        <span className="text-xs font-normal text-muted-foreground">
          Shown on live tracking so everyone knows where this stands.
        </span>
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

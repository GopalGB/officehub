import type {
  EnhancementStatus,
  Priority,
  ProjectStatus,
  TaskStatus,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const tone = {
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  active:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  waiting:
    "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  blocked:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
};
const statusTone = (status: string) =>
  ["COMPLETED", "DONE"].includes(status)
    ? tone.done
    : ["IN_PROGRESS", "APPROVED"].includes(status)
      ? tone.active
      : ["BLOCKED", "REJECTED"].includes(status)
        ? tone.blocked
        : ["ON_HOLD", "IN_REVIEW"].includes(status)
          ? tone.waiting
          : tone.neutral;

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function dot(filled: boolean) {
  return (
    <span
      aria-hidden="true"
      className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
        filled ? "bg-current" : "border border-current"
      }`}
    />
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const filled = status === "COMPLETED" || status === "IN_PROGRESS";
  const variant = status === "COMPLETED" ? "default" : "secondary";
  return (
    <Badge variant={variant} className={statusTone(status)}>
      {dot(filled)}
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  // Keep urgency readable without depending on color alone.
  const bars =
    priority === "CRITICAL"
      ? 4
      : priority === "HIGH"
        ? 3
        : priority === "MEDIUM"
          ? 2
          : 1;
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${priority === "CRITICAL" ? tone.blocked : priority === "HIGH" ? tone.waiting : tone.neutral}`}
    >
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`block w-[2px] rounded-sm ${
              i <= bars ? "bg-current" : "bg-neutral-300 dark:bg-neutral-700"
            }`}
            style={{ height: `${i * 2 + 2}px` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </Badge>
  );
}

const ENH_LABEL: Record<EnhancementStatus, string> = {
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  REJECTED: "Rejected",
};

export function EnhancementStatusBadge({
  status,
}: {
  status: EnhancementStatus;
}) {
  const filled = status === "DONE";
  const variant =
    status === "DONE"
      ? "default"
      : status === "REJECTED"
        ? "outline"
        : "secondary";
  return (
    <Badge variant={variant} className={statusTone(status)}>
      {dot(filled)}
      {ENH_LABEL[status]}
    </Badge>
  );
}

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABEL).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const PRIORITY_OPTIONS = (
  ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Priority[]
).map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

export const ENHANCEMENT_STATUS_OPTIONS = Object.entries(ENH_LABEL).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

// Task labels + monochrome variants
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const filled = status === "DONE" || status === "IN_PROGRESS";
  const variant = status === "DONE" ? "default" : "secondary";
  return (
    <Badge variant={variant} className={statusTone(status)}>
      {dot(filled)}
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABEL).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

// Shared report workflow colors for badges and inline menus.
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  TODO: tone.neutral,
  IN_PROGRESS: tone.active,
  IN_REVIEW: tone.waiting,
  BLOCKED: tone.blocked,
  DONE: tone.done,
};

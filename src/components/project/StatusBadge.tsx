import type { EnhancementStatus, Priority, ProjectStatus, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

// Monochrome — all badges are black/white/gray. State is conveyed via
// label + dot prefix where helpful, not by hue.

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
        filled ? "bg-black dark:bg-white" : "border border-black dark:border-white"
      }`}
    />
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const filled = status === "COMPLETED" || status === "IN_PROGRESS";
  const variant = status === "COMPLETED" ? "default" : "secondary";
  return (
    <Badge variant={variant}>
      {dot(filled)}
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  // Show urgency with dot count + weight, not color.
  const bars = priority === "CRITICAL" ? 4 : priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
  const label = priority.charAt(0) + priority.slice(1).toLowerCase();
  return (
    <Badge variant="outline" className="gap-1">
      <span className="inline-flex items-end gap-px" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`block w-[2px] rounded-sm ${
              i <= bars ? "bg-black dark:bg-white" : "bg-neutral-300 dark:bg-neutral-700"
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

export function EnhancementStatusBadge({ status }: { status: EnhancementStatus }) {
  const filled = status === "DONE";
  const variant = status === "DONE" ? "default" : status === "REJECTED" ? "outline" : "secondary";
  return (
    <Badge variant={variant}>
      {dot(filled)}
      {ENH_LABEL[status]}
    </Badge>
  );
}

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const PRIORITY_OPTIONS = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Priority[]).map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

export const ENHANCEMENT_STATUS_OPTIONS = Object.entries(ENH_LABEL).map(([value, label]) => ({
  value,
  label,
}));

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
    <Badge variant={variant}>
      {dot(filled)}
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Tone classes for inline status menus — monochrome
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  TODO: "bg-white text-black border-black/15 dark:bg-black dark:text-white dark:border-white/20",
  IN_PROGRESS: "bg-neutral-100 text-black border-black/30 dark:bg-neutral-900 dark:text-white dark:border-white/30",
  IN_REVIEW: "bg-neutral-50 text-black border-black/20 dark:bg-neutral-900 dark:text-white dark:border-white/20",
  BLOCKED: "bg-white text-black border-black underline decoration-2 underline-offset-2 dark:bg-black dark:text-white dark:border-white",
  DONE: "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white",
};

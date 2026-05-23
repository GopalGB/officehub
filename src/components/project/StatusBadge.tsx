import type { EnhancementStatus, Priority, ProjectStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const PROJECT_STATUS_VARIANT: Record<ProjectStatus, "info" | "success" | "danger" | "muted" | "warning"> = {
  PLANNING: "info",
  IN_PROGRESS: "info",
  BLOCKED: "danger",
  ON_HOLD: "warning",
  COMPLETED: "success",
  ARCHIVED: "muted",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={PROJECT_STATUS_VARIANT[status]}>{PROJECT_STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_VARIANT: Record<Priority, "muted" | "info" | "warning" | "danger"> = {
  LOW: "muted",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "danger",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</Badge>;
}

const ENH_VARIANT: Record<EnhancementStatus, "muted" | "info" | "success" | "warning" | "danger"> = {
  PROPOSED: "muted",
  APPROVED: "info",
  IN_PROGRESS: "info",
  DONE: "success",
  REJECTED: "danger",
};
const ENH_LABEL: Record<EnhancementStatus, string> = {
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  REJECTED: "Rejected",
};
export function EnhancementStatusBadge({ status }: { status: EnhancementStatus }) {
  return <Badge variant={ENH_VARIANT[status]}>{ENH_LABEL[status]}</Badge>;
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

import type { TaskStatus } from "@prisma/client";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const TASK_STATUS_VARIANT: Record<TaskStatus, "muted" | "info" | "warning" | "danger" | "success"> = {
  TODO: "muted",
  IN_PROGRESS: "info",
  IN_REVIEW: "warning",
  BLOCKED: "danger",
  DONE: "success",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={TASK_STATUS_VARIANT[status]}>{TASK_STATUS_LABEL[status]}</Badge>;
}

export const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-700 border-slate-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-900 border-indigo-200",
  IN_REVIEW: "bg-amber-50 text-amber-900 border-amber-200",
  BLOCKED: "bg-rose-50 text-rose-900 border-rose-200",
  DONE: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

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

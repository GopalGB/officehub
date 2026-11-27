import { z } from "zod";

/** Why a delivery date moved. Kept short so managers can compare across projects. */
export const SCHEDULE_REASONS = [
  { value: "SCOPE", label: "Scope change / new requirement" },
  { value: "ENHANCEMENT", label: "Enhancement added" },
  { value: "DEPENDENCY", label: "Waiting on data or another team" },
  { value: "RESOURCE", label: "People unavailable / leave" },
  { value: "PRIORITY", label: "Priority changed" },
  { value: "REQUIREMENT", label: "Requirement unclear" },
  { value: "TECHNICAL", label: "Technical issue" },
  { value: "EARLIER", label: "Finishing earlier than planned" },
  { value: "OTHER", label: "Other" },
] as const;
export const ScheduleReasonEnum = z.enum([
  "SCOPE",
  "ENHANCEMENT",
  "DEPENDENCY",
  "RESOURCE",
  "PRIORITY",
  "REQUIREMENT",
  "TECHNICAL",
  "EARLIER",
  "OTHER",
]);
export type ScheduleReason = z.infer<typeof ScheduleReasonEnum>;

export function reasonLabel(value: string | null | undefined) {
  if (!value) return "Reason not recorded";
  return SCHEDULE_REASONS.find((r) => r.value === value)?.label ?? value;
}

/** Calendar-day key: dates are stored at UTC midnight. */
export function dayKey(date: Date | string | null | undefined) {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function daysBetween(from: Date | string, to: Date | string) {
  return Math.round((Date.parse(dayKey(to)!) - Date.parse(dayKey(from)!)) / 86_400_000);
}

export type ChangeRow = {
  field: string;
  fromDate: Date | null;
  toDate: Date | null;
  enhancementId: string | null;
  createdAt: Date;
};

export type ScheduleSummary = {
  baselineTarget: Date | null;
  currentTarget: Date | null;
  slipDays: number;
  reschedules: number;
  completedAt: Date | null;
  lateVsBaseline: number | null;
  lateVsTarget: number | null;
  deliveryWithEnhancements: Date | null;
  enhancementExtensionDays: number;
  state: "UNSCHEDULED" | "ON_PLAN" | "SLIPPED" | "PULLED_IN" | "DONE_ON_TIME" | "DONE_LATE";
};

/**
 * Baseline = the first target the project ever had (the "from" of its first
 * target change, or the current target if it never moved). Enhancements never
 * rewrite the original delivery; they are reported as an extension beyond it.
 */
export function scheduleSummary(input: {
  targetDate: Date | null;
  actualEndDate: Date | null;
  status: string;
  changes: ChangeRow[];
  enhancements: { targetDate: Date | null; completedAt: Date | null; status: string }[];
}): ScheduleSummary {
  const projectTargetChanges = input.changes
    .filter((c) => c.field === "TARGET" && !c.enhancementId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const firstSet = projectTargetChanges.find((c) => c.fromDate);
  const baselineTarget = firstSet?.fromDate ?? input.targetDate ?? projectTargetChanges.find((c) => c.toDate)?.toDate ?? null;
  const currentTarget = input.targetDate;
  const reschedules = projectTargetChanges.filter((c) => c.fromDate && dayKey(c.fromDate) !== dayKey(c.toDate)).length;
  const slipDays = baselineTarget && currentTarget ? daysBetween(baselineTarget, currentTarget) : 0;
  const done = input.status === "COMPLETED";
  const completedAt = done ? input.actualEndDate : null;
  const lateVsBaseline = completedAt && baselineTarget ? daysBetween(baselineTarget, completedAt) : null;
  const lateVsTarget = completedAt && currentTarget ? daysBetween(currentTarget, completedAt) : null;

  const projectEnd = completedAt ?? currentTarget;
  const enhancementEnds = input.enhancements
    .filter((e) => e.status !== "REJECTED")
    .map((e) => e.completedAt ?? e.targetDate)
    .filter((d): d is Date => !!d);
  const latest = [projectEnd, ...enhancementEnds]
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const enhancementExtensionDays = latest && projectEnd ? Math.max(0, daysBetween(projectEnd, latest)) : 0;

  const state: ScheduleSummary["state"] = !currentTarget && !completedAt
    ? "UNSCHEDULED"
    : done
      ? lateVsTarget !== null && lateVsTarget > 0
        ? "DONE_LATE"
        : "DONE_ON_TIME"
      : slipDays > 0
        ? "SLIPPED"
        : slipDays < 0
          ? "PULLED_IN"
          : "ON_PLAN";

  return {
    baselineTarget,
    currentTarget,
    slipDays,
    reschedules,
    completedAt,
    lateVsBaseline,
    lateVsTarget,
    deliveryWithEnhancements: latest,
    enhancementExtensionDays,
    state,
  };
}

export const STATE_LABEL: Record<ScheduleSummary["state"], string> = {
  UNSCHEDULED: "No target date",
  ON_PLAN: "On original plan",
  SLIPPED: "Delayed",
  PULLED_IN: "Ahead of original plan",
  DONE_ON_TIME: "Delivered on time",
  DONE_LATE: "Delivered late",
};

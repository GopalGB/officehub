"use client";

import { useTransition } from "react";
import type { ProjectStatus } from "@prisma/client";
import { quickUpdateProjectStatus } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";
import { PROJECT_STATUS_OPTIONS } from "./StatusBadge";
import { cn } from "@/lib/utils";

// Monochrome tones — distinguishable via fill vs outline, not color.
const TONE: Record<ProjectStatus, string> = {
  PLANNING: "bg-white text-black border-black/15 dark:bg-black dark:text-white dark:border-white/20",
  IN_PROGRESS: "bg-neutral-100 text-black border-black/30 dark:bg-neutral-900 dark:text-white dark:border-white/30",
  BLOCKED: "bg-white text-black border-black underline decoration-2 underline-offset-2 dark:bg-black dark:text-white dark:border-white",
  ON_HOLD: "bg-neutral-50 text-neutral-600 border-black/15 dark:bg-neutral-900 dark:text-neutral-300 dark:border-white/20",
  COMPLETED: "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white",
  ARCHIVED: "bg-neutral-50 text-neutral-500 border-black/10 dark:bg-neutral-900 dark:text-neutral-500 dark:border-white/10",
};

export function QuickStatusMenu({
  projectId,
  status,
  canEdit,
}: {
  projectId: string;
  status: ProjectStatus;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  if (!canEdit) {
    return (
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium",
          TONE[status],
        )}
      >
        {status.replace("_", " ")}
      </span>
    );
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as ProjectStatus;
        if (next === status) return;
        start(async () => {
          try {
            await quickUpdateProjectStatus(projectId, next);
            toast(`Moved to ${PROJECT_STATUS_OPTIONS.find((o) => o.value === next)?.label}`, "success");
          } catch (err) {
            e.target.value = status;
            toast(err instanceof Error ? err.message : "Could not change status", "error");
          }
        });
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "h-7 appearance-none rounded-md border px-2 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-50 dark:focus:ring-white/30",
        TONE[status],
      )}
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'currentColor\'%3E%3Cpath fill-rule=\'evenodd\' d=\'M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z\' clip-rule=\'evenodd\'/%3E%3C/svg%3E")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.4rem center",
        backgroundSize: "1rem",
      }}
    >
      {PROJECT_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useTransition } from "react";
import type { ProjectStatus } from "@prisma/client";
import { quickUpdateProjectStatus } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";
import { PROJECT_STATUS_OPTIONS } from "./StatusBadge";
import { cn } from "@/lib/utils";

const TONE: Record<ProjectStatus, string> = {
  PLANNING: "bg-sky-50 text-sky-900 border-sky-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-900 border-indigo-200",
  BLOCKED: "bg-rose-50 text-rose-900 border-rose-200",
  ON_HOLD: "bg-amber-50 text-amber-900 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-900 border-emerald-200",
  ARCHIVED: "bg-slate-100 text-slate-600 border-slate-200",
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
          await quickUpdateProjectStatus(projectId, next);
          toast(`Moved to ${PROJECT_STATUS_OPTIONS.find((o) => o.value === next)?.label}`, "success");
        });
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "h-7 appearance-none rounded-md border px-2 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50",
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

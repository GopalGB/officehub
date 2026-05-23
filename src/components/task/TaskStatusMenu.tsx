"use client";

import { useTransition } from "react";
import type { TaskStatus } from "@prisma/client";
import { quickChangeTaskStatus } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";
import { TASK_STATUS_OPTIONS, TASK_STATUS_TONE, TASK_STATUS_LABEL } from "@/components/project/StatusBadge";
import { cn } from "@/lib/utils";

export function TaskStatusMenu({
  taskId,
  status,
  disabled,
}: {
  taskId: string;
  status: TaskStatus;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <select
      value={status}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value as TaskStatus;
        if (next === status) return;
        start(async () => {
          await quickChangeTaskStatus(taskId, next);
          toast(`Moved to ${TASK_STATUS_LABEL[next]}`, "success");
        });
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "h-7 appearance-none rounded-md border px-2 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50",
        TASK_STATUS_TONE[status],
      )}
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'currentColor\'%3E%3Cpath fill-rule=\'evenodd\' d=\'M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z\' clip-rule=\'evenodd\'/%3E%3C/svg%3E")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.4rem center",
        backgroundSize: "1rem",
      }}
    >
      {TASK_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

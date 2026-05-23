"use client";

import { useTransition } from "react";
import { quickAssignTask } from "@/app/dashboard/actions";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";

interface Person {
  id: string;
  name: string;
}

export function AssigneeMenu({
  taskId,
  assignee,
  options,
  disabled,
}: {
  taskId: string;
  assignee: Person | null;
  options: Person[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <div className="inline-flex items-center gap-1.5">
      {assignee ? <Avatar name={assignee.name} size="sm" /> : (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400">
          ?
        </span>
      )}
      <select
        value={assignee?.id ?? ""}
        disabled={disabled || pending}
        onChange={(e) => {
          const next = e.target.value || null;
          start(async () => {
            await quickAssignTask(taskId, next);
            toast(
              next
                ? `Assigned to ${options.find((o) => o.id === next)?.name}`
                : "Unassigned",
              "success",
            );
          });
        }}
        className="h-7 appearance-none rounded border border-slate-200 bg-white px-2 pr-6 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 20 20\' fill=\'currentColor\'%3E%3Cpath fill-rule=\'evenodd\' d=\'M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z\' clip-rule=\'evenodd\'/%3E%3C/svg%3E")',
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.3rem center",
          backgroundSize: "0.9rem",
        }}
      >
        <option value="">Unassigned</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import type { Milestone } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

export function MilestoneList({
  projectId,
  items,
  onAdd,
  onToggle,
  onDelete,
  canManage,
}: {
  projectId: string;
  items: Milestone[];
  onAdd: (projectId: string, fd: FormData) => Promise<void>;
  onToggle: (id: string, projectId: string, completed: boolean) => Promise<void>;
  onDelete: (id: string, projectId: string) => Promise<void>;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {canManage && (
        <form
          action={(fd) => start(() => onAdd(projectId, fd))}
          className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]"
        >
          <div className="space-y-1">
            <Label htmlFor="m-title">Milestone</Label>
            <Input id="m-title" name="title" required placeholder="e.g. Beta with 5 office users" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="m-due">Due</Label>
            <Input id="m-due" name="dueDate" type="date" />
          </div>
          <div className="self-end">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
        {items.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">No milestones yet.</li>
        )}
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={m.completed}
                disabled={!canManage || pending}
                onChange={(ev) => start(() => onToggle(m.id, projectId, ev.target.checked))}
                className="h-4 w-4 rounded border-slate-300"
              />
              <div>
                <p className={`text-sm ${m.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {m.title}
                </p>
                <p className="text-xs text-slate-400">
                  {m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No due date"}
                  {m.completed && m.completedAt ? ` · Completed ${formatDate(m.completedAt)}` : ""}
                </p>
              </div>
            </div>
            {canManage && (
              <form action={() => start(() => onDelete(m.id, projectId))}>
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

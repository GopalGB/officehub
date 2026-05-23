"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createTask } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";
import { PRIORITY_OPTIONS } from "@/components/project/StatusBadge";

interface Person {
  id: string;
  name: string;
}

export function TaskQuickAdd({
  projectId,
  assignees,
}: {
  projectId: string;
  assignees: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function onSubmit(fd: FormData) {
    if (!String(fd.get("title") ?? "").trim()) return;
    start(async () => {
      await createTask(projectId, fd);
      toast("Task added", "success");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add task
      </Button>
    );
  }
  return (
    <form
      action={onSubmit}
      onReset={() => setOpen(false)}
      className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_140px_140px_140px_auto]"
    >
      <Input name="title" autoFocus required placeholder="Task title (Enter to save)" />
      <Select name="priority" defaultValue="MEDIUM" className="h-9 text-xs">
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select name="assigneeId" defaultValue="" className="h-9 text-xs">
        <option value="">Unassigned</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Input name="dueDate" type="date" className="h-9" />
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
        <Button type="reset" size="sm" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}

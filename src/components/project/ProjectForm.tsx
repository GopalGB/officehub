"use client";

import { useState, useTransition } from "react";
import type { Block } from "@blocknote/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BlockField } from "@/components/editor/BlockField";
import { PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS } from "./StatusBadge";
import type { Priority, ProjectStatus } from "@prisma/client";

interface Props {
  action: (formData: FormData) => Promise<void>;
  initial?: {
    title?: string;
    summary?: string | null;
    description?: Block[] | null;
    status?: ProjectStatus;
    priority?: Priority;
    startDate?: Date | null;
    targetDate?: Date | null;
  };
  submitLabel?: string;
}

function toInputDate(d: Date | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

export function ProjectForm({ action, initial, submitLabel = "Save project" }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(fd) => start(async () => {
        setError(null);
        try { await action(fd); } catch (cause) {
          // Next handles successful action redirects before resolving this call.
          setError(cause instanceof Error ? cause.message : "Could not save project");
        }
      })}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" name="title" required minLength={2} defaultValue={initial?.title ?? ""} maxLength={160} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">One-line summary</Label>
        <Textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={500}
          defaultValue={initial?.summary ?? ""}
          placeholder="What's this project about, in one sentence?"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={initial?.status ?? "PLANNING"}>
            {PROJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue={initial?.priority ?? "MEDIUM"}>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={toInputDate(initial?.startDate)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetDate">Target date</Label>
          <Input id="targetDate" name="targetDate" type="date" defaultValue={toInputDate(initial?.targetDate)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <BlockField name="description" initial={initial?.description ?? null} />
        <p className="text-xs text-slate-500">Rich notes — formatting, lists, headings. Type / for blocks.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

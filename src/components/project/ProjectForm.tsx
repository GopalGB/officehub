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
    ownerId?: string;
    coOwnerId?: string | null;
    projectType?: string;
    sourceProjectId?: string | null;
    estimatedHours?: number | null;
    savedHours?: number | null;
    department?: string | null;
    acceptanceCriteria?: string | null;
    version?: number;
    summary?: string | null;
    description?: Block[] | null;
    status?: ProjectStatus;
    priority?: Priority;
    startDate?: Date | null;
    targetDate?: Date | null;
  };
  people?: { id: string; name: string }[];
  projects?: { id: string; title: string }[];
  canChangeOwner?: boolean;
  ownerSelectable?: boolean;
  currentUserId?: string;
  submitLabel?: string;
}

function toInputDate(d: Date | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

export function ProjectForm({
  action,
  initial,
  people = [],
  projects = [],
  canChangeOwner = false,
  ownerSelectable = true,
  currentUserId,
  submitLabel = "Save project",
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          try {
            await action(fd);
          } catch (cause) {
            // Next handles successful action redirects before resolving this call.
            setError(
              cause instanceof Error ? cause.message : "Could not save project",
            );
          }
        })
      }
      className="space-y-6"
    >
      {initial?.version && (
        <input type="hidden" name="expectedVersion" value={initial.version} />
      )}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          defaultValue={initial?.title ?? ""}
          maxLength={160}
        />
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
          <Select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "PLANNING"}
          >
            {PROJECT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            id="priority"
            name="priority"
            defaultValue={initial?.priority ?? "MEDIUM"}
          >
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
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toInputDate(initial?.startDate)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetDate">Target date</Label>
          <Input
            id="targetDate"
            name="targetDate"
            type="date"
            defaultValue={toInputDate(initial?.targetDate)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ownerId">Project owner</Label>
          <Select
            id="ownerId"
            name="ownerId"
            defaultValue={initial?.ownerId ?? currentUserId}
            disabled={!canChangeOwner || !ownerSelectable}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coOwnerId">Sub-owner</Label>
          <Select
            id="coOwnerId"
            name="coOwnerId"
            defaultValue={initial?.coOwnerId ?? ""}
            disabled={!canChangeOwner}
          >
            <option value="">No sub-owner</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectType">Type</Label>
          <Select
            id="projectType"
            name="projectType"
            defaultValue={initial?.projectType ?? "NEW_PROJECT"}
          >
            <option value="NEW_PROJECT">New project</option>
            <option value="ENHANCEMENT">Enhancement</option>
            <option value="SUPPORT">Support / maintenance</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceProjectId">Enhances / follows project</Label>
          <Select
            id="sourceProjectId"
            name="sourceProjectId"
            defaultValue={initial?.sourceProjectId ?? ""}
          >
            <option value="">Standalone project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedHours">Estimated effort (hours)</Label>
          <Input
            id="estimatedHours"
            name="estimatedHours"
            type="number"
            min="0"
            max="100000"
            step="0.25"
            defaultValue={initial?.estimatedHours ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="savedHours">Expected time saved (hours / week)</Label>
          <Input
            id="savedHours"
            name="savedHours"
            type="number"
            min="0"
            max="100000"
            step="0.25"
            defaultValue={initial?.savedHours ?? ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="department">Team / department</Label>
          <Input
            id="department"
            name="department"
            maxLength={100}
            defaultValue={initial?.department ?? ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="acceptanceCriteria">
            Success criteria / definition of done
          </Label>
          <Textarea
            id="acceptanceCriteria"
            name="acceptanceCriteria"
            rows={3}
            maxLength={5000}
            defaultValue={initial?.acceptanceCriteria ?? ""}
            placeholder="What needs to be delivered, checked, and accepted?"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <BlockField name="description" initial={initial?.description ?? null} />
        <p className="text-xs text-slate-500">
          Rich notes — formatting, lists, headings. Type / for blocks.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

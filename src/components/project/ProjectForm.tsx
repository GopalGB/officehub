"use client";

import { useState, useTransition } from "react";
import type { Block } from "@blocknote/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BlockField } from "@/components/editor/BlockField";
import { AdditionalDetailsEditor } from "@/components/project/AdditionalDetailsEditor";
import {
  additionalDetailsSchema,
  type AdditionalDetail,
} from "@/lib/additional-details";
import { PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS } from "./StatusBadge";
import type { Priority, ProjectStatus } from "@prisma/client";
import {
  KEEP_ASSIGNMENT,
  preserveCurrentAllocations,
} from "@/lib/allocation-form";

interface Props {
  action: (formData: FormData) => Promise<void>;
  initial?: {
    title?: string;
    ownerId?: string;
    ownerName?: string;
    coOwnerId?: string | null;
    coOwnerName?: string | null;
    projectType?: string;
    sourceProjectId?: string | null;
    estimatedHours?: number | null;
    savedHours?: number | null;
    department?: string | null;
    subTeam?: string | null;
    additionalDetails?: AdditionalDetail[];
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
  const keepOwner =
    !!initial?.ownerId &&
    !people.some((person) => person.id === initial.ownerId);
  const keepCoOwner =
    !!initial?.coOwnerId &&
    !people.some((person) => person.id === initial.coOwnerId);

  return (
    <form
      onInvalidCapture={(event) => {
        // Native validation must be able to focus fields in a closed section.
        const control = event.target;
        if (control instanceof HTMLElement) {
          let ancestor = control.parentElement;
          while (ancestor) {
            if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
            ancestor = ancestor.parentElement;
          }
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const revealDetails = () =>
          form.querySelectorAll("details").forEach((detail) => {
            detail.open = true;
          });
        const fd = new FormData(form);
        start(async () => {
          setError(null);
          try {
            const raw = fd.get("additionalDetails");
            if (typeof raw === "string") {
              const checked = additionalDetailsSchema.safeParse(
                JSON.parse(raw),
              );
              if (!checked.success) {
                revealDetails();
                setError(
                  checked.error.issues[0]?.message ??
                    "Check additional details",
                );
                return;
              }
            }
            await action(preserveCurrentAllocations(fd));
          } catch (cause) {
            revealDetails();
            // Next handles successful action redirects before resolving this call.
            setError(
              cause instanceof Error ? cause.message : "Could not save project",
            );
          }
        });
      }}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </div>

      <div
        id="timeline-dates"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
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
            defaultValue={
              keepOwner
                ? KEEP_ASSIGNMENT
                : people.some(
                      (p) => p.id === (initial?.ownerId ?? currentUserId),
                    )
                  ? (initial?.ownerId ?? currentUserId)
                  : ""
            }
            disabled={!canChangeOwner || !ownerSelectable}
            required
          >
            <option value="" disabled>
              Choose a project owner
            </option>
            {keepOwner && (
              <option value={KEEP_ASSIGNMENT}>Keep current owner</option>
            )}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {keepOwner && (
            <p className="text-xs text-muted-foreground">
              Current owner: {initial?.ownerName ?? "Existing account"}. Choose
              a team member to transfer ownership.
            </p>
          )}
          {!people.length && (
            <p className="text-xs text-muted-foreground">
              Add a team member before allocating work. Admin accounts manage
              the workspace.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="coOwnerId">Sub-owner</Label>
          <Select
            id="coOwnerId"
            name="coOwnerId"
            defaultValue={
              keepCoOwner ? KEEP_ASSIGNMENT : (initial?.coOwnerId ?? "")
            }
            disabled={!canChangeOwner}
          >
            <option value="">No sub-owner</option>
            {keepCoOwner && (
              <option value={KEEP_ASSIGNMENT}>Keep current sub-owner</option>
            )}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {keepCoOwner && (
            <p className="text-xs text-muted-foreground">
              Current sub-owner: {initial?.coOwnerName ?? "Existing account"}.
            </p>
          )}
        </div>
      </div>
      <details className="disclosure">
        <summary>
          More project details{" "}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Optional
          </span>
        </summary>
        <div className="disclosure-body">
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="sourceProjectId">
                Enhances / follows project
              </Label>
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
              <Label htmlFor="savedHours">
                Expected time saved (hours / week)
              </Label>
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
            <div className="space-y-2">
              <Label htmlFor="department">Team / department</Label>
              <Input
                id="department"
                name="department"
                maxLength={100}
                defaultValue={initial?.department ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subTeam">Sub-team</Label>
              <Input
                id="subTeam"
                name="subTeam"
                maxLength={100}
                defaultValue={initial?.subTeam ?? ""}
                placeholder="Optional"
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

          <AdditionalDetailsEditor initial={initial?.additionalDetails} />

          <div className="space-y-2">
            <Label>Description</Label>
            <BlockField
              name="description"
              initial={initial?.description ?? null}
            />
            <p className="text-xs text-slate-500">
              Rich notes — formatting, lists, headings. Type / for blocks.
            </p>
          </div>
        </div>
      </details>
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

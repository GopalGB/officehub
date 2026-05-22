"use client";

import { useTransition } from "react";
import type { Enhancement, User } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ENHANCEMENT_STATUS_OPTIONS,
  EnhancementStatusBadge,
  PriorityBadge,
  PRIORITY_OPTIONS,
} from "./StatusBadge";
import { timeAgo } from "@/lib/utils";

type EnhancementWithAuthor = Enhancement & { author: Pick<User, "id" | "name"> };

export function EnhancementList({
  projectId,
  items,
  onAdd,
  onUpdate,
  onDelete,
  viewerId,
  canManage,
}: {
  projectId: string;
  items: EnhancementWithAuthor[];
  onAdd: (projectId: string, fd: FormData) => Promise<void>;
  onUpdate: (id: string, projectId: string, fd: FormData) => Promise<void>;
  onDelete: (id: string, projectId: string) => Promise<void>;
  viewerId: string;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <form
        action={(fd) => start(() => onAdd(projectId, fd))}
        className="grid gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="enh-title">New enhancement</Label>
            <Input id="enh-title" name="title" required maxLength={160} placeholder="What should change?" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="enh-priority">Priority</Label>
              <Select id="enh-priority" name="priority" defaultValue="MEDIUM">
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="enh-status">Status</Label>
              <Select id="enh-status" name="status" defaultValue="PROPOSED">
                {ENHANCEMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="enh-desc">Why? (optional)</Label>
          <Textarea id="enh-desc" name="description" rows={2} maxLength={2000} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Adding…" : "Add enhancement"}
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-400">No enhancements proposed yet.</p>
        )}
        {items.map((e) => {
          const ownItem = e.authorId === viewerId;
          return (
            <div key={e.id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{e.title}</h4>
                    <EnhancementStatusBadge status={e.status} />
                    <PriorityBadge priority={e.priority} />
                  </div>
                  {e.description && <p className="mt-1 text-sm text-slate-600">{e.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    by {e.author.name} · {timeAgo(e.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canManage && (
                    <form action={(fd) => start(() => onUpdate(e.id, projectId, fd))}>
                      <Select
                        name="status"
                        defaultValue={e.status}
                        className="h-8 text-xs"
                        onChange={(ev) => {
                          const fd = new FormData();
                          fd.set("status", ev.currentTarget.value);
                          start(() => onUpdate(e.id, projectId, fd));
                        }}
                      >
                        {ENHANCEMENT_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </form>
                  )}
                  {(ownItem || canManage) && (
                    <form action={() => start(() => onDelete(e.id, projectId))}>
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

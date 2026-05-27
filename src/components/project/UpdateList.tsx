"use client";

import { useState, useTransition } from "react";
import type { Block } from "@blocknote/core";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { BlockReader } from "@/components/editor/BlockReader";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

interface UpdateItem {
  id: string;
  content: Block[] | null;
  createdAt: Date | string;
  author: { name: string };
}

export function UpdateList({
  updates,
  onAdd,
}: {
  updates: UpdateItem[];
  onAdd: (formData: FormData) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Block[] | null>(null);
  const [pending, start] = useTransition();
  const [resetKey, setResetKey] = useState(0);
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Add status update</h3>
        <form
          action={(fd) => {
            fd.set("content", JSON.stringify(draft ?? []));
            start(async () => {
              try {
                await onAdd(fd);
                setDraft(null);
                setResetKey((k) => k + 1);
                toast("Update posted", "success");
              } catch (e) {
                toast(e instanceof Error ? e.message : "Could not post update", "error");
              }
            });
          }}
          className="space-y-3"
        >
          <BlockEditor key={resetKey} onChange={setDraft} placeholder="What changed since last update?" />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !draft || draft.length === 0}>
              {pending ? "Posting…" : "Post update"}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">History</h3>
        {updates.length === 0 ? (
          <p className="text-sm text-slate-400">No updates yet.</p>
        ) : (
          updates.map((u) => (
            <div key={u.id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <Avatar name={u.author.name} className="h-6 w-6 text-[10px]" />
                <span className="text-sm font-medium">{u.author.name}</span>
                <span className="text-xs text-slate-400">· {timeAgo(u.createdAt)}</span>
              </div>
              <BlockReader content={u.content} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

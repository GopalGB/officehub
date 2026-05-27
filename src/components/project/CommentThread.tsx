"use client";

import { useRef, useTransition } from "react";
import type { Comment, User } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

type CommentWithAuthor = Comment & { author: Pick<User, "id" | "name"> };

export function CommentThread({
  projectId,
  items,
  viewerId,
  canManage,
  onAdd,
  onDelete,
}: {
  projectId: string;
  items: CommentWithAuthor[];
  viewerId: string;
  canManage: boolean;
  onAdd: (projectId: string, fd: FormData) => Promise<void>;
  onDelete: (id: string, projectId: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-4">
      <form
        ref={ref}
        action={(fd) =>
          start(async () => {
            try {
              await onAdd(projectId, fd);
              ref.current?.reset();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Could not post comment", "error");
            }
          })
        }
        className="space-y-2 rounded-md border border-slate-200 bg-white p-4"
      >
        <Textarea name="content" required rows={2} placeholder="Add a comment…" />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div key={c.id} className="flex gap-3 rounded-md border border-slate-200 bg-white p-3">
              <Avatar name={c.author.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{c.author.name}</span>
                    <span className="text-xs text-slate-400">{timeAgo(c.createdAt)}</span>
                  </div>
                  {(c.authorId === viewerId || canManage) && (
                    <form action={() => start(() => onDelete(c.id, projectId))}>
                      <Button type="submit" variant="ghost" size="sm">
                        Delete
                      </Button>
                    </form>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

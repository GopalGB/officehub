"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setProjectMembers } from "@/app/dashboard/actions";

interface Person {
  id: string;
  name: string;
  email?: string;
}

export function MembersPicker({
  projectId,
  ownerName,
  allUsers,
  selectedIds,
  canEdit,
}: {
  projectId: string;
  ownerName: string;
  allUsers: Person[];
  selectedIds: string[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function toggle(id: string) {
    const prev = new Set(selected);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    start(async () => {
      try {
        await setProjectMembers(projectId, Array.from(next));
        toast("Members updated", "success");
      } catch (e) {
        setSelected(prev); // revert optimistic update
        toast(e instanceof Error ? e.message : "Could not update members", "error");
      }
    });
  }

  const selectedPeople = allUsers.filter((u) => selected.has(u.id));
  const unselected = allUsers.filter((u) => !selected.has(u.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs">
          <Avatar name={ownerName} size="sm" />
          <span className="font-medium text-slate-700">{ownerName}</span>
          <span className="text-slate-400">· owner</span>
        </div>
        {selectedPeople.map((p) => (
          <div
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs"
          >
            <Avatar name={p.name} size="sm" />
            <span className="font-medium text-slate-700">{p.name}</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => toggle(p.id)}
                disabled={pending}
                className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              disabled={pending}
            >
              <Plus className="h-3.5 w-3.5" /> Add member
            </Button>
            {open && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg animate-fade-in">
                  <ul className="max-h-[50vh] overflow-y-auto py-1">
                    {unselected.length === 0 ? (
                      <li className="px-3 py-4 text-center text-xs text-slate-400">
                        Everyone on the team is already added.
                      </li>
                    ) : (
                      unselected.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => {
                              toggle(u.id);
                              setOpen(false);
                            }}
                            disabled={pending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                          >
                            <Avatar name={u.name} size="sm" />
                            <span className="min-w-0 flex-1 truncate">{u.name}</span>
                            {u.email && (
                              <span className="truncate text-xs text-slate-400">{u.email}</span>
                            )}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Members can view and edit this project regardless of their global role.
      </p>
    </div>
  );
}

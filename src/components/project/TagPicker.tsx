"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import type { Tag } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setProjectTags, createTag } from "@/app/dashboard/actions";

const COLOR_SWATCHES = [
  "#94a3b8",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function TagPicker({
  projectId,
  allTags,
  selectedIds,
  canEdit,
}: {
  projectId: string;
  allTags: Tag[];
  selectedIds: string[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);
  const { toast } = useToast();

  function toggle(id: string) {
    if (!canEdit) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    start(async () => {
      await setProjectTags(projectId, Array.from(next));
    });
  }

  function add() {
    if (!newName.trim()) return;
    const fd = new FormData();
    fd.set("name", newName.trim());
    fd.set("color", newColor);
    start(async () => {
      await createTag(fd);
      toast(`Added "${newName.trim()}"`, "success");
      setNewName("");
      setAdding(false);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allTags.length === 0 && (
          <span className="text-xs text-slate-400">No tags yet — create one below.</span>
        )}
        {allTags.map((t) => {
          const on = selected.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={!canEdit || pending}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                on ? "border-slate-900 text-white" : "border-slate-200 text-slate-700 hover:border-slate-400"
              }`}
              style={{
                backgroundColor: on ? t.color : `${t.color}22`,
                color: on ? "#fff" : undefined,
                borderColor: on ? t.color : undefined,
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: on ? "#fff" : t.color }} />
              {t.name}
            </button>
          );
        })}
      </div>

      {canEdit && (
        <div>
          {adding ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name (e.g. Engineering)"
                className="h-8 max-w-[200px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                autoFocus
              />
              <div className="flex items-center gap-1">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    aria-label={`Use color ${c}`}
                    className={`h-5 w-5 rounded-full border ${newColor === c ? "ring-2 ring-slate-400 ring-offset-1" : ""}`}
                    style={{ backgroundColor: c, borderColor: c }}
                  />
                ))}
              </div>
              <Button type="button" size="sm" onClick={add} disabled={pending || !newName.trim()}>
                Add
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" />
              New tag
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

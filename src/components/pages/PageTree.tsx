"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Plus, FileText } from "lucide-react";
import { createPage } from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";

export interface PageNode {
  id: string;
  title: string;
  emoji: string | null;
  children: PageNode[];
}

export function PageTree({
  nodes,
  currentId,
}: {
  nodes: PageNode[];
  currentId?: string;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => (
        <TreeRow key={n.id} node={n} depth={0} currentId={currentId} />
      ))}
      <li>
        <NewPageButton parentId={null} label="+ New top-level page" />
      </li>
    </ul>
  );
}

function TreeRow({
  node,
  depth,
  currentId,
}: {
  node: PageNode;
  depth: number;
  currentId?: string;
}) {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(depth < 1 || node.children.some((c) => containsCurrent(c, currentId)));
  const active = node.id === currentId;
  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded px-1 py-1 text-sm hover:bg-slate-100",
          active && "bg-slate-900 text-white hover:bg-slate-900",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          aria-label={open ? "Collapse" : "Expand"}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-200",
            active && "hover:bg-slate-800",
            !hasChildren && "invisible",
          )}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Link
          href={`/dashboard/pages/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate"
        >
          {node.emoji ? (
            <span className="text-xs">{node.emoji}</span>
          ) : (
            <FileText className={cn("h-3.5 w-3.5 shrink-0", active ? "text-white/70" : "text-slate-400")} />
          )}
          <span className="truncate">{node.title || "Untitled"}</span>
        </Link>
        <NewPageInline parentId={node.id} active={active} />
      </div>
      {open && hasChildren && (
        <ul className="space-y-0.5">
          {node.children.map((c) => (
            <TreeRow key={c.id} node={c} depth={depth + 1} currentId={currentId} />
          ))}
        </ul>
      )}
    </li>
  );
}

function containsCurrent(node: PageNode, currentId?: string): boolean {
  if (!currentId) return false;
  if (node.id === currentId) return true;
  return node.children.some((c) => containsCurrent(c, currentId));
}

function NewPageInline({ parentId, active }: { parentId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set("parentId", parentId);
        fd.set("title", "Untitled");
        start(() => createPage(fd));
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="submit"
        aria-label="New child page"
        disabled={pending}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 hover:bg-slate-200",
          active ? "hover:bg-slate-800 text-white/80" : "text-slate-500",
        )}
      >
        <Plus className="h-3 w-3" />
      </button>
    </form>
  );
}

function NewPageButton({ parentId, label }: { parentId: string | null; label: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        if (parentId) fd.set("parentId", parentId);
        fd.set("title", "Untitled");
        start(() => createPage(fd));
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100"
      >
        {pending ? "Creating…" : label}
      </button>
    </form>
  );
}

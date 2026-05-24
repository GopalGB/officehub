"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FolderKanban,
  CheckSquare,
  BookOpen,
  User as UserIcon,
  LayoutDashboard,
  Columns3,
  Calendar,
  Settings,
  Plus,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResults {
  projects: { id: string; title: string; summary: string | null; status: string }[];
  tasks: { id: string; title: string; status: string; projectId: string; project: { title: string } }[];
  pages: { id: string; title: string; emoji: string | null }[];
  users: { id: string; name: string; email: string; role: string }[];
}

interface Item {
  key: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  href: string;
  group: "Quick" | "Projects" | "Tasks" | "Pages" | "People";
}

const QUICK: Item[] = [
  { key: "dash", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", group: "Quick" },
  { key: "tasks", label: "Tasks", icon: CheckSquare, href: "/dashboard/tasks", group: "Quick" },
  { key: "board", label: "Project board", icon: Columns3, href: "/dashboard/board", group: "Quick" },
  { key: "tboard", label: "Task board", icon: Columns3, href: "/dashboard/tasks/board", group: "Quick" },
  { key: "cal", label: "Calendar", icon: Calendar, href: "/dashboard/calendar", group: "Quick" },
  { key: "wiki", label: "Wiki", icon: BookOpen, href: "/dashboard/pages", group: "Quick" },
  { key: "new-p", label: "New project", icon: Plus, href: "/dashboard/projects/new", group: "Quick" },
  { key: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings", group: "Quick" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults(null);
    setActive(0);
  }, []);

  // Cmd/Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setResults(j.data ?? null))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, open]);

  const items: Item[] = useMemo(() => {
    const quickMatching = q.trim()
      ? QUICK.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
      : QUICK;
    const r = results;
    const out: Item[] = [...quickMatching];
    r?.projects.forEach((p) =>
      out.push({
        key: `p-${p.id}`,
        label: p.title,
        hint: p.summary ?? p.status.toLowerCase().replace("_", " "),
        icon: FolderKanban,
        href: `/dashboard/projects/${p.id}`,
        group: "Projects",
      }),
    );
    r?.tasks.forEach((t) =>
      out.push({
        key: `t-${t.id}`,
        label: t.title,
        hint: `${t.project.title} · ${t.status.toLowerCase().replace("_", " ")}`,
        icon: CheckSquare,
        href: `/dashboard/projects/${t.projectId}`,
        group: "Tasks",
      }),
    );
    r?.pages.forEach((p) =>
      out.push({
        key: `pg-${p.id}`,
        label: `${p.emoji ? p.emoji + " " : ""}${p.title || "Untitled"}`,
        icon: BookOpen,
        href: `/dashboard/pages/${p.id}`,
        group: "Pages",
      }),
    );
    r?.users.forEach((u) =>
      out.push({
        key: `u-${u.id}`,
        label: u.name,
        hint: `${u.email} · ${u.role.toLowerCase()}`,
        icon: UserIcon,
        href: `/dashboard/team`,
        group: "People",
      }),
    );
    return out;
  }, [q, results]);

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  function go(item?: Item) {
    const target = item ?? items[active];
    if (!target) return;
    router.push(target.href);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  }

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in-fast" onClick={close} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-fade-in">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, tasks, pages, people…"
            className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              {q.trim().length < 2 ? "Type to search…" : "No matches"}
            </p>
          ) : (
            items.map((item, idx) => {
              const showGroupHeader = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.key}>
                  {showGroupHeader && (
                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      active === idx ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && (
                      <span
                        className={cn(
                          "truncate text-xs",
                          active === idx ? "text-white/70" : "text-slate-400",
                        )}
                      >
                        {item.hint}
                      </span>
                    )}
                    {active === idx && <CornerDownLeft className="h-3 w-3 shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-semibold">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-semibold">↵</kbd> Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-semibold">esc</kbd> Close
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-semibold">⌘K</kbd> anywhere
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBar() {
  // Visual button that triggers Cmd+K palette via synthetic key event.
  function openPalette() {
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-sm text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500",
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">Search projects, tasks, pages, people…</span>
      <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 md:inline">
        ⌘K
      </kbd>
    </button>
  );
}

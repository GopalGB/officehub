"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  Folders,
  Columns3,
  Users2,
  Settings,
  BarChart3,
  CheckSquare,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdmin, isManagerOrAbove } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare, show: true },
    { href: "/dashboard/board", label: "Project board", icon: Columns3, show: true },
    { href: "/dashboard/projects/new", label: "New project", icon: Folders, show: true },
    { href: "/dashboard/pages", label: "Wiki", icon: BookOpen, show: true },
    { href: "/dashboard/manager", label: "Manager", icon: BarChart3, show: isManagerOrAbove(role) },
    { href: "/dashboard/team", label: "Team", icon: Users2, show: isAdmin(role) },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, show: true },
  ].filter((l) => l.show);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative ml-auto flex h-full w-72 flex-col border-l border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-semibold">OfficeHub</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 overflow-y-auto">
              {links.map((l) => {
                const active =
                  pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{l.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

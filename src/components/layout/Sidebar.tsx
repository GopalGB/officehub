"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { isManagerOrAbove, isAdmin } from "@/lib/rbac";
import {
  Folders,
  LayoutDashboard,
  Users2,
  Settings,
  Columns3,
  BarChart3,
  CheckSquare,
  BookOpen,
  Calendar,
} from "lucide-react";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    show: boolean;
    exact?: boolean;
  };
  const sections: { heading: string; items: NavItem[] }[] = [
    {
      heading: "Home",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true, exact: true },
      ],
    },
    {
      heading: "Work",
      items: [
        { href: "/dashboard/projects/new", label: "New project", icon: Folders, show: true },
        { href: "/dashboard/board", label: "Project board", icon: Columns3, show: true },
        { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare, show: true },
        { href: "/dashboard/calendar", label: "Calendar", icon: Calendar, show: true },
        { href: "/dashboard/manager", label: "Manager view", icon: BarChart3, show: isManagerOrAbove(role) },
      ],
    },
    {
      heading: "Knowledge",
      items: [{ href: "/dashboard/pages", label: "Wiki", icon: BookOpen, show: true }],
    },
    {
      heading: "Admin",
      items: [
        { href: "/dashboard/team", label: "Team", icon: Users2, show: isAdmin(role) },
        { href: "/dashboard/settings", label: "Settings", icon: Settings, show: true },
      ],
    },
  ];

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-3 md:flex md:flex-col">
      <div className="mb-4 px-2 pt-1">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          OfficeHub
        </Link>
      </div>
      <nav className="flex flex-col gap-4 overflow-y-auto">
        {sections.map((sec) => {
          const visible = sec.items.filter((i) => i.show);
          if (visible.length === 0) return null;
          return (
            <div key={sec.heading}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {sec.heading}
              </p>
              <div className="flex flex-col gap-0.5">
                {visible.map((l) => {
                  const active = l.exact
                    ? pathname === l.href
                    : pathname === l.href || pathname.startsWith(l.href + "/");
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{l.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="mt-auto px-2 pt-4 text-xs text-slate-400">
        <p>OfficeHub · v1.4</p>
        <p className="mt-0.5">
          <kbd className="rounded border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-500">
            ⌘K
          </kbd>{" "}
          quick jump
        </p>
      </div>
    </aside>
  );
}

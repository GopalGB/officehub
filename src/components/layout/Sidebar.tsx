"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { isManagerOrAbove, isAdmin } from "@/lib/rbac";
import { Folders, LayoutDashboard, Users2, Settings } from "lucide-react";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "My projects", icon: LayoutDashboard, show: true },
    { href: "/dashboard/projects/new", label: "New project", icon: Folders, show: true },
    { href: "/dashboard/manager", label: "Manager view", icon: LayoutDashboard, show: isManagerOrAbove(role) },
    { href: "/dashboard/team", label: "Team", icon: Users2, show: isAdmin(role) },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, show: true },
  ].filter((l) => l.show);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:flex md:flex-col">
      <div className="mb-6 px-2">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          OfficeHub
        </Link>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

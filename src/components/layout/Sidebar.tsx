"use client";

import { BrandIdentity } from "@/components/layout/BrandIdentity";
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
        {
          href: "/dashboard",
          label: "My workspace",
          icon: LayoutDashboard,
          show: true,
          exact: true,
        },
      ],
    },
    {
      heading: "Work",
      items: [
        {
          href: "/dashboard/projects",
          label: "Projects",
          icon: Folders,
          show: true,
        },
        {
          href: "/dashboard/planner",
          label: "My week",
          icon: Calendar,
          show: true,
        },
        {
          href: "/dashboard/reports",
          label: "Reports",
          icon: CheckSquare,
          show: true,
        },
        {
          href: "/dashboard/calendar",
          label: "Fiscal calendar",
          icon: Calendar,
          show: true,
        },
        {
          href: "/dashboard/requests",
          label: "Request pool",
          icon: Folders,
          show: isManagerOrAbove(role),
        },
        {
          href: "/dashboard/manager",
          label: "Team overview",
          icon: BarChart3,
          show: isManagerOrAbove(role),
        },
      ],
    },
    {
      heading: "Knowledge",
      items: [
        { href: "/dashboard/pages", label: "Wiki", icon: BookOpen, show: true },
      ],
    },
    {
      // Personal/workspace settings belong to everyone; the Admin section is
      // strictly admin-only so the heading no longer leaks to MEMBERs (OH-13).
      heading: "Workspace",
      items: [
        {
          href: "/dashboard/settings",
          label: "Settings",
          icon: Settings,
          show: true,
        },
      ],
    },
    {
      heading: "Admin",
      items: [
        {
          href: "/dashboard/team",
          label: "Team",
          icon: Users2,
          show: isAdmin(role),
        },
      ],
    },
  ];

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-3 md:flex md:flex-col">
      <div className="mb-4 px-2 pt-1">
        <Link href="/dashboard" aria-label="Catalyst Brands workspace">
          <BrandIdentity />
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
                    : (pathname === l.href ||
                        (l.href === "/dashboard/projects" &&
                          pathname === "/dashboard/board") ||
                        pathname.startsWith(l.href + "/")) &&
                      !visible.some(
                        (other) =>
                          other.href.length > l.href.length &&
                          (pathname === other.href ||
                            pathname.startsWith(other.href + "/")),
                      );
                  const Icon = l.icon;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-brand-tint text-brand-navy font-semibold shadow-[inset_3px_0_0_#DD6328]"
                          : "text-brand-navy hover:bg-accent",
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
        <p className="font-medium text-brand-navy">
          Catalyst Brands · Workspace
        </p>
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

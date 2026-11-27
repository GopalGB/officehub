import type { Role } from "@prisma/client";
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckSquare,
  FileSpreadsheet,
  Folders,
  GraduationCap,
  HandHelping,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MessageSquareHeart,
  Plane,
  Settings,
  Users2,
  Video,
} from "lucide-react";
import { isAdmin, isManagerOrAbove } from "@/lib/rbac";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

/** One list for the sidebar and the mobile drawer, grouped and role-filtered. */
export function navSections(role: Role): { heading: string; items: NavItem[] }[] {
  const manager = isManagerOrAbove(role);
  const sections: { heading: string; items: (NavItem & { show?: boolean })[] }[] = [
    {
      heading: "Home",
      items: [
        { href: "/dashboard", label: "My workspace", icon: LayoutDashboard, exact: true },
        { href: "/dashboard/reminders", label: "Reminders", icon: Bell },
      ],
    },
    {
      heading: "Work",
      items: [
        { href: "/dashboard/projects", label: "Projects", icon: Folders },
        { href: "/dashboard/reports", label: "Reports", icon: CheckSquare },
        { href: "/dashboard/planner", label: "My week", icon: Calendar },
        { href: "/dashboard/help", label: "Help pool", icon: HandHelping },
        { href: "/dashboard/requests", label: "Request intake", icon: Inbox, show: manager },
        { href: "/dashboard/manager", label: "Team overview", icon: BarChart3, show: manager },
      ],
    },
    {
      heading: "Team",
      items: [
        { href: "/dashboard/meetings", label: "Meetings", icon: Video },
        { href: "/dashboard/leaves", label: "Leaves", icon: Plane },
        { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
      ],
    },
    {
      heading: "Resources",
      items: [
        { href: "/dashboard/pages", label: "Wiki & contacts", icon: BookOpen },
        { href: "/dashboard/training", label: "Training", icon: GraduationCap },
        { href: "/dashboard/vault", label: "Servers & passwords", icon: KeyRound },
        { href: "/dashboard/excel", label: "Linked Excel", icon: FileSpreadsheet },
        { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareHeart },
      ],
    },
    {
      heading: "Workspace",
      items: [
        { href: "/dashboard/settings", label: "Settings", icon: Settings },
        { href: "/dashboard/team", label: "Team members", icon: Users2, show: isAdmin(role) },
      ],
    },
  ];
  return sections
    .map((s) => ({ heading: s.heading, items: s.items.filter((i) => i.show !== false) }))
    .filter((s) => s.items.length);
}

export function isNavActive(item: NavItem, pathname: string, all: NavItem[]) {
  if (item.exact) return pathname === item.href;
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const own = matches(item.href) || (item.href === "/dashboard/projects" && pathname === "/dashboard/board");
  return own && !all.some((other) => other.href.length > item.href.length && matches(other.href));
}

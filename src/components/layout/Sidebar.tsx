"use client";

import { BrandIdentity } from "@/components/layout/BrandIdentity";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { navSections, isNavActive } from "@/lib/nav";

/** Keep primary destinations short; project views and import live within Projects. */
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const sections = navSections(role);
  const all = sections.flatMap((s) => s.items);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-3 md:flex md:flex-col">
      <div className="mb-4 px-2 pt-1">
        <Link href="/dashboard" aria-label="Catalyst Brands workspace">
          <BrandIdentity />
        </Link>
      </div>
      <nav className="flex flex-col gap-4 overflow-y-auto">
        {sections.map((sec) => {
          const visible = sec.items;
          return (
            <div key={sec.heading}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {sec.heading}
              </p>
              <div className="flex flex-col gap-0.5">
                {visible.map((l) => {
                  const active = isNavActive(l, pathname, all);
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

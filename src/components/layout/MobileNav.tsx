"use client";

import { BrandIdentity } from "@/components/layout/BrandIdentity";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { navSections, isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

/** Mirror the role-filtered workspace destinations in the mobile drawer. */
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const sections = navSections(role);
  const links = sections.flatMap((s) => s.items);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-black md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative ml-auto flex h-full w-72 flex-col border-l border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <Link
                href="/dashboard"
                aria-label="Catalyst Brands workspace"
                onClick={() => setOpen(false)}
              >
                <BrandIdentity className="h-14 w-48" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-neutral-100"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-3 overflow-y-auto">
              {sections.map((section) => (
                <div key={section.heading}>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.heading}
                  </p>
                  {section.items.map((l) => {
                    const active = isNavActive(l, pathname, links);
                    const Icon = l.icon;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-2 border-brand-orange/50 bg-brand-tint text-brand-navy font-semibold"
                            : "text-brand-navy hover:bg-accent",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{l.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

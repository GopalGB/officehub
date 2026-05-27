"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_TEMPLATES } from "@/lib/pageTemplates";
import { createPageFromTemplate } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function NewPagePicker() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function pick(templateKey: string) {
    start(async () => {
      try {
        await createPageFromTemplate(templateKey);
        toast("Page created", "success");
        setOpen(false);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not create page", "error");
      }
    });
  }

  return (
    <div className="relative">
      <Button type="button" onClick={() => setOpen((o) => !o)} disabled={pending}>
        <Plus className="h-4 w-4" /> {pending ? "Creating…" : "New page"}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg animate-fade-in">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Start from a template
            </div>
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {PAGE_TEMPLATES.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => pick(t.key)}
                    disabled={pending}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50",
                    )}
                  >
                    <span className="mt-0.5 text-lg">{t.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{t.label}</p>
                      <p className="text-xs text-slate-500">{t.description}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

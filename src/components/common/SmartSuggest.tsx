"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { suggestForDraft } from "@/app/dashboard/actions";
import { isFailure } from "@/lib/action-result";
import type { Suggestion } from "@/lib/smart-suggest";

/** Watches the surrounding form's title/summary/description and suggests
 * hours saved, brand and type from similar past work, and flags look-alikes.
 * Similarity matching on words, computed on the OfficeHub server. */
export function SmartSuggest({ kind, excludeId }: { kind: "project" | "report"; excludeId?: string }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Suggestion | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    let timer = 0;
    let seq = 0;
    const read = () => {
      const value = (name: string) => {
        const el = form.elements.namedItem(name);
        return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "";
      };
      return [value("title"), value("summary"), value("description")].join(" ").trim();
    };
    const run = () => {
      const text = read();
      if (text.length < 4) return setData(null);
      const mine = ++seq;
      void suggestForDraft(kind, text, excludeId ?? null)
        .then((result) => {
          if (mine === seq && !isFailure(result)) setData(result);
        })
        .catch(() => undefined);
    };
    const onInput = (event: Event) => {
      const name = (event.target as HTMLInputElement | null)?.name;
      if (!["title", "summary", "description"].includes(name ?? "")) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 700);
    };
    form.addEventListener("input", onInput);
    run();
    return () => {
      form.removeEventListener("input", onInput);
      window.clearTimeout(timer);
    };
  }, [kind, excludeId]);

  const fill = (name: string, value: string) => {
    const form = anchor.current?.closest("form");
    const el = form?.elements.namedItem(name);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // Reveal a closed optional section so people see what changed.
    let parent = el.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    setApplied((a) => [...a, name]);
  };

  const has = data && (data.hoursSaved || data.brand || data.reportKind || data.similar.length);
  return (
    <div ref={anchor} className={has ? "sm:col-span-2" : "hidden"} aria-live="polite">
      {has && (
        <div className="space-y-2 rounded-lg border border-brand-blue/30 bg-blue-50/60 p-3 text-xs text-brand-navy">
          <p className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Suggestions from similar past work
          </p>
          <div className="flex flex-wrap gap-2">
            {data.hoursSaved && (
              <button
                type="button"
                className="rounded-md border bg-white px-2 py-1 hover:border-brand-orange"
                onClick={() => fill("savedHours", String(data.hoursSaved!.value))}
                title={`Based on: ${data.hoursSaved.basedOn.join(", ")}`}
              >
                {applied.includes("savedHours") ? "✓ " : "Use "}
                {data.hoursSaved.value} h saved / week
              </button>
            )}
            {data.brand && (
              <button
                type="button"
                className="rounded-md border bg-white px-2 py-1 hover:border-brand-orange"
                onClick={() => fill("brand", data.brand!.name)}
                title={`Brand ${data.brand.reason}`}
              >
                {applied.includes("brand") ? "✓ " : "Use "}brand {data.brand.name}
              </button>
            )}
            {data.reportKind && (
              <button
                type="button"
                className="rounded-md border bg-white px-2 py-1 hover:border-brand-orange"
                onClick={() => fill("kind", data.reportKind!.value)}
              >
                {applied.includes("kind") ? "✓ " : "Use "}type {data.reportKind.label}
              </button>
            )}
          </div>
          {data.hoursSaved && (
            <p className="text-[11px] text-muted-foreground">Hours estimate based on: {data.hoursSaved.basedOn.join(", ")}</p>
          )}
          {data.similar.length > 0 && (
            <div>
              <p className="font-semibold text-brand-orange">Possible duplicates — check before creating:</p>
              <ul className="mt-1 space-y-0.5">
                {data.similar.map((s) => (
                  <li key={s.href}>
                    <a className="text-link" href={s.href} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      · {s.type} · {s.score}% similar
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Word-similarity matching on this server. Nothing is filled in until you click.
          </p>
        </div>
      )}
    </div>
  );
}

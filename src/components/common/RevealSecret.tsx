"use client";
import { settle } from "@/lib/action-result";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";

/** Fetch a password only when asked; hide it again after 30 seconds. */
export function RevealSecret({ reveal }: { reveal: () => Promise<unknown> }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const load = (then?: (value: string) => void) =>
    start(async () => {
      try {
        const value = secret ?? String(await settle(reveal)());
        setSecret(value);
        window.setTimeout(() => setSecret(null), 30_000);
        then?.(value);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not open this password", "error");
      }
    });
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <code className="rounded bg-secondary px-2 py-1 text-xs">{secret === null ? "••••••••" : secret || "(no password saved)"}</code>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-secondary"
        disabled={pending}
        onClick={() => (secret === null ? load() : setSecret(null))}
      >
        {secret === null ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {secret === null ? "Show" : "Hide"}
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-secondary"
        disabled={pending}
        onClick={() =>
          load((value) => {
            void copyText(value).then((ok) =>
              toast(ok ? "Password copied" : "Select the password and press Ctrl+C", ok ? "success" : "info"),
            );
          })
        }
      >
        <Copy className="h-3 w-3" /> Copy
      </button>
    </span>
  );
}

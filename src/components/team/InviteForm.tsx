"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Copy, Check } from "lucide-react";
import { createInvitation } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];

export function InviteForm() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ url: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function onSubmit(fd: FormData) {
    setError(null);
    setResult(null);
    setCopied(false);
    start(async () => {
      const r = await createInvitation(fd);
      if ("error" in r) {
        setError(r.error);
        toast(r.error, "error");
      } else {
        setResult(r);
        toast(`Invite link ready for ${r.email}`, "success");
      }
    });
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    toast("Invite link copied", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <form action={onSubmit} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <div className="space-y-1">
          <Label htmlFor="i-email">Email</Label>
          <Input id="i-email" name="email" type="email" required placeholder="teammate@office.local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="i-role">Role</Label>
          <Select id="i-role" name="role" defaultValue="MEMBER">
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="self-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create invite link"}
          </Button>
        </div>
      </form>

      {error && (
        <p className="rounded border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black dark:border-white dark:bg-black dark:text-white">{error}</p>
      )}

      {result && (
        <div className="rounded-md border-2 border-black bg-white p-3 dark:border-white dark:bg-black">
          <p className="text-sm font-medium text-black dark:text-white">
            Share this link with <strong>{result.email}</strong> — they&apos;ll set their own password.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded border border-black/15 bg-white px-2 py-1.5 text-xs text-black dark:border-white/20 dark:bg-neutral-950 dark:text-white">
              {result.url}
            </code>
            <Button type="button" size="sm" variant={copied ? "secondary" : "default"} onClick={copy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Link expires in 14 days.</p>
        </div>
      )}
    </div>
  );
}

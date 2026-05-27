"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { revokeInvitation } from "@/app/dashboard/actions";
import { timeAgo } from "@/lib/utils";

interface Invite {
  id: string;
  email: string;
  role: string;
  url: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  invitedByName: string;
}

export function PendingInvites({ invites }: { invites: Invite[] }) {
  const [pending, start] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  async function copy(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast("Invite link copied", "success");
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  }

  function revoke(id: string, email: string) {
    if (!confirm(`Revoke the invite for ${email}?`)) return;
    start(async () => {
      try {
        await revokeInvitation(id);
        toast(`Revoked invite for ${email}`, "info");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not revoke invitation", "error");
      }
    });
  }

  if (invites.length === 0) {
    return <p className="text-sm text-slate-400">No pending invites.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Invited by</th>
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invites.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-3 font-medium">{i.email}</td>
              <td className="px-4 py-3">
                <Badge variant="muted">{i.role}</Badge>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {i.invitedByName} · {timeAgo(i.createdAt)}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(i.expiresAt)}</td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy(i.id, i.url)}
                  >
                    {copiedId === i.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="ml-1 hidden sm:inline">{copiedId === i.id ? "Copied" : "Copy link"}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => revoke(i.id, i.email)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

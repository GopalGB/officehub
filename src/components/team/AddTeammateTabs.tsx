"use client";

import { useState } from "react";
import { Link as LinkIcon, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { InviteForm } from "./InviteForm";
import { CreateUserForm } from "./CreateUserForm";

const TABS = [
  {
    key: "invite" as const,
    label: "Invite link",
    icon: LinkIcon,
    sub: "They pick their own password",
  },
  {
    key: "password" as const,
    label: "Set password",
    icon: KeyRound,
    sub: "Admin sets it (stays in this server)",
  },
];

export function AddTeammateTabs() {
  const [tab, setTab] = useState<"invite" | "password">("invite");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-col items-start rounded px-3 py-2 text-left transition-colors",
                active ? "bg-white shadow-sm" : "hover:bg-white/60",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Icon className="h-4 w-4" />
                {t.label}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">{t.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in-fast">
        {tab === "invite" ? <InviteForm /> : <CreateUserForm />}
      </div>
    </div>
  );
}

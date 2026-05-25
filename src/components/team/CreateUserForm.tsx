"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createUser } from "@/app/dashboard/actions";
import { RefreshCw } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];

function suggestPassword() {
  // Memorable + meets policy: Word + Digits + Bang
  const words = ["Mango", "Falcon", "Cobalt", "Maple", "Orbit", "Quartz", "Atlas", "Pine", "Lumen", "Echo"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}${num}!`;
}

export function CreateUserForm() {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState(suggestPassword);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      try {
        fd.set("password", password);
        await createUser(fd);
        toast(`Account created for ${fd.get("email")}`, "success");
        ref.current?.reset();
        setPassword(suggestPassword());
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create user";
        setError(msg);
        toast(msg, "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      <form
        ref={ref}
        action={onSubmit}
        className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_140px_auto]"
      >
        <div className="space-y-1">
          <Label htmlFor="cu-name">Name</Label>
          <Input id="cu-name" name="name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cu-email">Email</Label>
          <Input id="cu-email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cu-password">Password</Label>
          <div className="flex items-center gap-1">
            <Input
              id="cu-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPassword(suggestPassword())}
              title="Regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cu-role">Role</Label>
          <Select id="cu-role" name="role" defaultValue="MEMBER">
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="self-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>
      <p className="text-xs text-slate-500">
        Password is hashed (bcrypt cost 12) and stored locally in this server&apos;s Postgres —
        nothing leaves the box. Share the password with the user; they can change it from Settings.
      </p>
      {error && (
        <p className="rounded border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black dark:border-white dark:bg-black dark:text-white">
          {error}
        </p>
      )}
    </div>
  );
}

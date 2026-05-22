import { signOut } from "../../../auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@prisma/client";

export function Header({ name, email, role }: { name: string; email: string; role: Role }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <Badge variant="muted">{role}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 sm:inline">{email}</span>
        <Avatar name={name} />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}

import { signOut } from "../../../auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import type { Role } from "@prisma/client";

export function Header({
  name,
  email,
  role,
  mobileNav,
}: {
  name: string;
  email: string;
  role: Role;
  mobileNav?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      {mobileNav}
      <div className="hidden flex-1 md:block">
        <SearchBar />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Badge variant="muted" className="hidden sm:inline-flex">
          {role}
        </Badge>
        <span className="hidden text-xs text-slate-500 lg:inline">{email}</span>
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

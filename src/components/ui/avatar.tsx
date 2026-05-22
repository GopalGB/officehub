import * as React from "react";
import { cn, initials } from "@/lib/utils";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 select-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700",
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

// Small client wrapper for a <select> that submits its enclosing <form>
// on change. Needed because Server Components can't pass event-handler props
// to client elements directly.
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
}: {
  name: string;
  defaultValue?: string;
  options: Option[];
  className?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => (e.currentTarget.form as HTMLFormElement)?.submit()}
      className={cn(
        "h-8 rounded-md border border-black/15 bg-white px-2 text-xs text-black focus:outline-none focus:ring-2 focus:ring-black/30 dark:border-white/20 dark:bg-black dark:text-white",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

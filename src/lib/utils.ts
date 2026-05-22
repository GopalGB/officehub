import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined, fallback = "—") {
  if (!d) return fallback;
  return format(new Date(d), "dd MMM yyyy");
}

export function formatDateTime(d: Date | string | null | undefined, fallback = "—") {
  if (!d) return fallback;
  return format(new Date(d), "dd MMM yyyy, HH:mm");
}

export function timeAgo(d: Date | string | null | undefined, fallback = "—") {
  if (!d) return fallback;
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

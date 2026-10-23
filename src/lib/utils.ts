import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True when a date-only deadline is before today in the viewer's local time.
 * Due dates come from <input type="date"> and are stored as UTC midnight, so
 * comparing the raw timestamp against `new Date()` falsely flags items due
 * later today as overdue in western timezones (OH-12). Compare calendar days instead.
 */
export function isOverdueDate(due: Date | string | null | undefined): boolean {
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  const dueUtcDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const todayLocalDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return dueUtcDay < todayLocalDay;
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

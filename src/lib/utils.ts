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
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return fallback;
  // Deadlines are date-only values stored at UTC midnight.
  return format(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), "dd MMM yyyy");
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

export function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Wall-clock times typed into datetime-local fields are stored as entered
 * (UTC) so every viewer sees the time that was typed, whatever the server zone. */
export function formatWallTime(d: Date | string | null | undefined, fallback = "—") {
  if (!d) return fallback;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(
    new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes()),
    "EEE dd MMM yyyy, HH:mm",
  );
}

export function wallTimeInput(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 16) : "";
}

/** "Now" in the same stored-as-typed convention, for defaults and comparisons. */
export function wallNow() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()));
}

/** Next.js signals redirect()/notFound() from server actions with special
 * errors; client catch blocks must let them through instead of toasting. */
export function isNavigationSignal(error: unknown) {
  const digest =
    error && typeof error === "object" && "digest" in error ? String(error.digest) : "";
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND";
}

/** JSON.parse that returns null instead of throwing on bad input. */
export function parseJSON<T = unknown>(value: unknown): T | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

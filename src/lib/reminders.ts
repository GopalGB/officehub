import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { addDays } from "@/lib/fiscal";

export const REPEAT_OPTIONS = [
  { value: "NONE", label: "Once" },
  { value: "DAILY", label: "Every weekday" },
  { value: "WEEKLY", label: "Every week" },
  { value: "MONTHLY", label: "Every month" },
] as const;

export const reminderSchema = z.object({
  title: z.string().trim().min(2, "Add what to remember").max(200),
  dueAt: z.iso.date(),
  repeat: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("NONE"),
  taskId: z.preprocess((v) => (v === "" ? null : v), z.string().cuid().nullable().optional()),
  credentialId: z.preprocess((v) => (v === "" ? null : v), z.string().cuid().nullable().optional()),
});

/** Next occurrence after `from`; weekday repeats skip Saturday and Sunday. */
export function nextOccurrence(dueAt: Date, repeat: string, from = new Date()) {
  let next = new Date(dueAt);
  const step = (d: Date) => {
    if (repeat === "DAILY") {
      let n = addDays(d, 1);
      while (n.getUTCDay() === 0 || n.getUTCDay() === 6) n = addDays(n, 1);
      return n;
    }
    if (repeat === "WEEKLY") return addDays(d, 7);
    const m = new Date(d);
    m.setUTCMonth(m.getUTCMonth() + 1);
    return m;
  };
  if (repeat === "NONE") return null;
  do next = step(next);
  while (next <= from);
  return next;
}

/** Everything due within `days`, for one viewer: own reminders, assigned
 * report deadlines, and expiring credentials they can see. */
export function upcomingWindow(days = 7, now = new Date()) {
  return { lte: addDays(now, days) } satisfies Prisma.DateTimeFilter;
}

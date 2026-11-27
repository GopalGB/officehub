import { db } from "@/lib/db";
import { addDays, localToday } from "@/lib/fiscal";

export type FeedItem = {
  key: string;
  kind: "Reminder" | "Report due" | "Password expires";
  title: string;
  dueAt: Date;
  href: string;
  reminderId?: string;
  repeat?: string;
};

/** Own reminders, assigned report deadlines and visible logins that expire. */
export async function reminderFeed(userId: string, days: number | null = 7) {
  const today = localToday();
  const until = days === null ? undefined : addDays(today, days + 1);
  const me = await db.user.findUnique({ where: { id: userId }, select: { team: true } });
  const [reminders, reports, credentials] = await Promise.all([
    db.reminder.findMany({
      where: { userId, doneAt: null, ...(until && { dueAt: { lt: until } }) },
      orderBy: { dueAt: "asc" },
      take: 200,
    }),
    db.task.findMany({
      where: { assigneeId: userId, status: { not: "DONE" }, dueDate: { not: null, ...(until && { lt: until }) } },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 200,
    }),
    db.credential.findMany({
      where: {
        expiresAt: { not: null, lt: addDays(today, Math.max(days ?? 30, 14) + 1) },
        OR: [{ ownerId: userId }, ...(me?.team ? [{ scope: "TEAM", team: me.team }] : [])],
      },
      select: { id: true, label: true, expiresAt: true },
      take: 200,
    }),
  ]);
  const items: FeedItem[] = [
    ...reminders.map((r) => ({
      key: `r-${r.id}`,
      kind: "Reminder" as const,
      title: r.title,
      dueAt: r.dueAt,
      href: r.taskId ? `/dashboard/reports/${r.taskId}` : r.credentialId ? "/dashboard/vault" : "/dashboard/reminders",
      reminderId: r.id,
      repeat: r.repeat,
    })),
    ...reports.map((t) => ({
      key: `t-${t.id}`,
      kind: "Report due" as const,
      title: t.title,
      dueAt: t.dueDate!,
      href: `/dashboard/reports/${t.id}`,
    })),
    ...credentials.map((c) => ({
      key: `c-${c.id}`,
      kind: "Password expires" as const,
      title: c.label,
      dueAt: c.expiresAt!,
      href: "/dashboard/vault",
    })),
  ];
  return items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

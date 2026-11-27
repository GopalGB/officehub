import Link from "next/link";
import { Bell } from "lucide-react";
import { reminderFeed } from "@/lib/reminder-feed";
import { completeReminder } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { localToday } from "@/lib/fiscal";
import { formatDate } from "@/lib/utils";

export async function RemindersPanel({ userId }: { userId: string }) {
  const items = (await reminderFeed(userId, 7)).slice(0, 8);
  const today = localToday().getTime();
  return (
    <section className="surface">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title flex items-center gap-2">
          <Bell className="h-4 w-4" /> Reminders this week
        </h2>
        <Link className="text-link text-xs" href="/dashboard/reminders">
          All reminders →
        </Link>
      </div>
      <ul className="mt-3 divide-y">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <Link href={item.href} className="min-w-0 hover:underline">
              <span className={`mr-2 text-[10px] font-semibold uppercase ${item.dueAt.getTime() < today ? "text-brand-orange" : "text-muted-foreground"}`}>
                {item.kind} · {item.dueAt.getTime() < today ? "Overdue " : ""}
                {formatDate(item.dueAt)}
              </span>
              {item.title}
            </Link>
            {item.reminderId && (
              <ActionForm action={completeReminder.bind(null, item.reminderId)} label="Done" className="" />
            )}
          </li>
        ))}
        {!items.length && <li className="py-3 text-sm text-muted-foreground">Nothing due in the next 7 days.</li>}
      </ul>
    </section>
  );
}

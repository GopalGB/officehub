import Link from "next/link";
import { auth } from "../../../../auth";
import { reminderFeed } from "@/lib/reminder-feed";
import { createReminder, completeReminder, deleteReminder } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { REPEAT_OPTIONS } from "@/lib/reminders";
import { dateKey, localToday } from "@/lib/fiscal";
import { formatDate } from "@/lib/utils";

export default async function RemindersPage() {
  const session = await auth();
  if (!session?.user) return null;
  const items = await reminderFeed(session.user.id, null);
  const today = localToday().getTime();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Home / Reminders</p>
        <h1 className="page-title">Reminders</h1>
        <p className="page-subtitle">
          Your own reminders, reports assigned to you with a deadline, and passwords that expire soon.
        </p>
      </header>
      <section className="surface">
        <h2 className="section-title">Add a reminder</h2>
        <ActionForm action={createReminder} label="Add reminder" successMessage="Reminder added." className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end">
          <label className="field">
            What to remember
            <input name="title" required minLength={2} maxLength={200} placeholder="e.g. Send the weekly JCP sales report" />
          </label>
          <label className="field">
            On
            <input name="dueAt" type="date" required defaultValue={dateKey(localToday())} />
          </label>
          <label className="field">
            Repeat
            <select name="repeat" defaultValue="NONE">
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </section>
      <section className="surface !p-0">
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase ${item.dueAt.getTime() < today ? "text-brand-orange" : "text-muted-foreground"}`}>
                  {item.kind} · {item.dueAt.getTime() < today ? "Overdue · " : ""}
                  {formatDate(item.dueAt)}
                  {item.repeat && item.repeat !== "NONE" ? ` · ${REPEAT_OPTIONS.find((o) => o.value === item.repeat)?.label}` : ""}
                </p>
                <Link className="text-sm font-medium hover:underline" href={item.href}>
                  {item.title}
                </Link>
              </div>
              {item.reminderId && (
                <div className="flex gap-2">
                  <ActionForm action={completeReminder.bind(null, item.reminderId)} label={item.repeat && item.repeat !== "NONE" ? "Done, next" : "Done"} className="" />
                  <ActionForm action={deleteReminder.bind(null, item.reminderId)} label="Remove" className="" />
                </div>
              )}
            </li>
          ))}
          {!items.length && <li className="px-5 py-10 text-center text-sm text-muted-foreground">You are all caught up.</li>}
        </ul>
      </section>
    </div>
  );
}

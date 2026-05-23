import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface DueItem {
  id: string;
  title: string;
  dueDate: Date;
  projectId: string;
  projectTitle: string;
}

export function DueSoonWidget({ items }: { items: DueItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">Nothing due in the next 14 days.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {items.map((m) => {
        const overdue = new Date(m.dueDate) < new Date();
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <CalendarClock
              className={`h-4 w-4 shrink-0 ${overdue ? "text-rose-500" : "text-slate-400"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{m.title}</p>
              <Link
                href={`/dashboard/projects/${m.projectId}`}
                className="text-xs text-slate-500 hover:underline"
              >
                {m.projectTitle}
              </Link>
            </div>
            <span className={`shrink-0 text-xs ${overdue ? "font-semibold text-rose-600" : "text-slate-500"}`}>
              {formatDate(m.dueDate)}
              {overdue && " · overdue"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

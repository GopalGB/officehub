import Link from "next/link";
import { TaskStatusBadge } from "@/components/project/StatusBadge";
import { formatDate } from "@/lib/utils";

interface Item {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE";
  dueDate: Date | null;
  projectId: string;
  projectTitle: string;
}

export function MyTasksWidget({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No open tasks assigned to you. <Link href="/dashboard/tasks" className="underline">Browse all</Link>.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {items.map((t) => {
        const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE";
        return (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{t.title}</p>
              <Link
                href={`/dashboard/projects/${t.projectId}`}
                className="text-xs text-slate-500 hover:underline"
              >
                {t.projectTitle}
              </Link>
            </div>
            <TaskStatusBadge status={t.status} />
            <span
              className={`shrink-0 text-xs ${overdue ? "font-semibold text-black underline decoration-2 underline-offset-2 dark:text-white" : "text-neutral-500 dark:text-neutral-400"}`}
            >
              {t.dueDate ? formatDate(t.dueDate) : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

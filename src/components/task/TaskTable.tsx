"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { Task, User, Project } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { TaskStatusMenu } from "./TaskStatusMenu";
import { AssigneeMenu } from "./AssigneeMenu";
import { PriorityBadge } from "@/components/project/StatusBadge";
import { Button } from "@/components/ui/button";
import { deleteTask } from "@/app/dashboard/actions";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

type Row = Task & {
  assignee: Pick<User, "id" | "name"> | null;
  reporter: Pick<User, "id" | "name">;
  project?: Pick<Project, "id" | "title">;
};

export function TaskTable({
  rows,
  assignees,
  viewerId,
  canManage,
  showProject = false,
}: {
  rows: Row[];
  assignees: Pick<User, "id" | "name">[];
  viewerId: string;
  canManage: boolean;
  showProject?: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function onDelete(taskId: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    start(async () => {
      await deleteTask(taskId);
      toast("Task deleted", "info");
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">No tasks yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2.5">Task</th>
            {showProject && <th className="px-3 py-2.5">Project</th>}
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Assignee</th>
            <th className="px-3 py-2.5">Priority</th>
            <th className="px-3 py-2.5">SP</th>
            <th className="px-3 py-2.5">Due</th>
            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((t) => {
            const overdue =
              t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE";
            const ownTask = t.reporterId === viewerId || t.assigneeId === viewerId;
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 align-middle">
                  <p className="font-medium text-slate-900">{t.title}</p>
                  {t.description && (
                    <p className="line-clamp-1 text-xs text-slate-500">{t.description}</p>
                  )}
                </td>
                {showProject && (
                  <td className="px-3 py-2 align-middle">
                    {t.project ? (
                      <Link
                        href={`/dashboard/projects/${t.project.id}`}
                        className="text-xs text-slate-600 hover:underline"
                      >
                        {t.project.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-3 py-2 align-middle">
                  <TaskStatusMenu taskId={t.id} status={t.status} disabled={!canManage && !ownTask} />
                </td>
                <td className="px-3 py-2 align-middle">
                  <AssigneeMenu
                    taskId={t.id}
                    assignee={t.assignee}
                    options={assignees}
                    disabled={!canManage && !ownTask}
                  />
                </td>
                <td className="px-3 py-2 align-middle">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className="px-3 py-2 align-middle text-xs text-slate-600">
                  {t.storyPoints ?? "—"}
                </td>
                <td
                  className={`px-3 py-2 align-middle text-xs ${overdue ? "font-semibold text-rose-600" : "text-slate-600"}`}
                >
                  {t.dueDate ? formatDate(t.dueDate) : "—"}
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  {(canManage || ownTask) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => onDelete(t.id, t.title)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Project, Task, TaskStatus, User } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/project/StatusBadge";
import { useToast } from "@/components/ui/toast";
import { quickChangeTaskStatus } from "@/app/dashboard/actions";
import { formatDate, cn } from "@/lib/utils";

type TaskWithRelations = Task & {
  assignee: Pick<User, "id" | "name"> | null;
  project?: Pick<Project, "id" | "title">;
};
type Column = { status: TaskStatus; label: string; ring: string };

export function TaskBoardClient({
  columns,
  initialTasks,
  viewerId,
  isManagerOrAbove,
}: {
  columns: Column[];
  initialTasks: TaskWithRelations[];
  viewerId: string;
  isManagerOrAbove: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function canMove(t: TaskWithRelations): boolean {
    return isManagerOrAbove || t.reporterId === viewerId || t.assigneeId === viewerId;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const newStatus = String(e.over.id) as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === newStatus) return;
    if (!canMove(task)) {
      toast("You can't move this task", "error");
      return;
    }

    const prev = tasks;
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    start(async () => {
      try {
        await quickChangeTaskStatus(taskId, newStatus);
        toast(`Moved to ${columns.find((c) => c.status === newStatus)?.label}`, "success");
      } catch (err) {
        setTasks(prev);
        toast(err instanceof Error ? err.message : "Could not move task", "error");
      }
    });
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const byStatus = columns.map((c) => ({
    ...c,
    items: tasks.filter((t) => t.status === c.status),
  }));

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {byStatus.map((col) => (
          <DroppableColumn key={col.status} column={col}>
            {col.items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-neutral-400">Empty</p>
            ) : (
              col.items.map((t) => (
                <DraggableCard key={t.id} task={t} canMove={canMove(t)} />
              ))
            )}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 cursor-grabbing opacity-90">
            <CardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
      {pending && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-black/15 bg-white px-3 py-1 text-xs text-neutral-700 shadow">
          Saving…
        </p>
      )}
    </DndContext>
  );
}

function DroppableColumn({
  column,
  children,
}: {
  column: Column & { items: TaskWithRelations[] };
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[400px] flex-col gap-2 rounded-md p-2 ring-1 transition-colors",
        column.ring,
        isOver && "ring-2 ring-black/50",
      )}
    >
      <div className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {column.label}
        </h2>
        <span className="text-xs font-semibold text-neutral-500">{column.items.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">{children}</div>
    </div>
  );
}

function DraggableCard({ task, canMove }: { task: TaskWithRelations; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canMove,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none",
        canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging && "opacity-30",
      )}
    >
      <CardBody task={task} />
    </div>
  );
}

function CardBody({ task }: { task: TaskWithRelations }) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
  return (
    <div className="rounded-md border border-black/10 bg-white p-3 shadow-sm transition hover:border-black/30 hover:shadow-md">
      <p className="text-sm font-semibold text-black">{task.title}</p>
      {task.project && (
        <Link
          href={`/dashboard/projects/${task.project.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-block text-[10px] text-neutral-500 hover:underline"
        >
          {task.project.title}
        </Link>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            <Avatar name={task.assignee.name} size="sm" />
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-neutral-300 text-[10px] text-neutral-400">
              ?
            </span>
          )}
          <PriorityBadge priority={task.priority} />
          {task.storyPoints != null && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
              {task.storyPoints}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 text-[10px] text-neutral-400">
        {task.dueDate ? (
          <span
            className={
              overdue ? "font-semibold text-black underline decoration-2 underline-offset-2" : ""
            }
          >
            Due {formatDate(task.dueDate)}
            {overdue && " · overdue"}
          </span>
        ) : (
          "No due date"
        )}
      </div>
    </div>
  );
}

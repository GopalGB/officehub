"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lock } from "lucide-react";
import type { Project, Task, TaskStatus, User } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/project/StatusBadge";
import { useToast } from "@/components/ui/toast";
import { moveTask } from "@/app/dashboard/actions";
import { formatDate, cn } from "@/lib/utils";
import { computePlacement } from "@/components/board/dnd-helpers";

type TaskWithRelations = Task & {
  assignee: Pick<User, "id" | "name"> | null;
  project?: Pick<Project, "id" | "title">;
};
type Column = {
  status: TaskStatus;
  label: string;
  tone: string;
  wipLimit?: number;
};

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
  const lastMoveRef = useRef<number>(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const knownStatuses = useMemo(() => columns.map((c) => c.status), [columns]);

  const byStatus = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.orderIndex - b.orderIndex);
    return columns.map((c) => ({ ...c, items: sorted.filter((t) => t.status === c.status) }));
  }, [columns, tasks]);

  function canMove(t: TaskWithRelations): boolean {
    return isManagerOrAbove || t.reporterId === viewerId || t.assigneeId === viewerId;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const activeIdStr = String(e.active.id);
    const overIdStr = e.over ? String(e.over.id) : null;
    if (!overIdStr) return;

    setTasks((curr) => {
      const active = curr.find((t) => t.id === activeIdStr);
      if (!active) return curr;

      let targetStatus: TaskStatus;
      if ((knownStatuses as readonly string[]).includes(overIdStr)) {
        targetStatus = overIdStr as TaskStatus;
      } else {
        const over = curr.find((t) => t.id === overIdStr);
        if (!over) return curr;
        targetStatus = over.status;
      }

      if (active.status === targetStatus) return curr;
      return curr.map((t) => (t.id === activeIdStr ? { ...t, status: targetStatus } : t));
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!canMove(task)) {
      setTasks(initialTasks);
      toast("You can't move this task", "error");
      return;
    }

    let toStatus: TaskStatus;
    let targetCardId: string | null = null;
    let placement: "above" | "below" = "below";

    if ((knownStatuses as readonly string[]).includes(overId)) {
      toStatus = overId as TaskStatus;
    } else {
      const overCard = tasks.find((t) => t.id === overId);
      if (!overCard) return;
      toStatus = overCard.status;
      targetCardId = overId;
      placement = computePlacement(active, over);
    }

    const col = columns.find((c) => c.status === toStatus);
    const newColCount = tasks.filter((t) => t.status === toStatus && t.id !== taskId).length + 1;
    if (col?.wipLimit && newColCount > col.wipLimit) {
      toast(`WIP limit exceeded in ${col.label} (${newColCount}/${col.wipLimit})`, "info");
    }

    const previousTasks = tasks;

    setTasks((curr) => {
      const updated = curr.map((t) =>
        t.id === taskId ? { ...t, status: toStatus } : t,
      );
      const colItems = updated
        .filter((t) => t.status === toStatus)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const fromIdx = colItems.findIndex((t) => t.id === taskId);
      let toIdx = targetCardId
        ? colItems.findIndex((t) => t.id === targetCardId) + (placement === "above" ? 0 : 1)
        : colItems.length;
      if (toIdx < 0) toIdx = colItems.length;
      const reordered = arrayMove(colItems, fromIdx, Math.max(0, Math.min(toIdx, colItems.length - 1)));
      const spread = new Map(reordered.map((t, i) => [t.id, i * 1024]));
      return updated.map((t) =>
        spread.has(t.id) ? { ...t, orderIndex: spread.get(t.id)! } : t,
      );
    });

    const moveAt = ++lastMoveRef.current;
    start(async () => {
      try {
        await moveTask({ taskId, toStatus, targetCardId, placement });
        if (moveAt === lastMoveRef.current) {
          toast(`Moved to ${col?.label ?? toStatus}`, "success");
        }
      } catch (err) {
        setTasks(previousTasks);
        toast(err instanceof Error ? err.message : "Could not move task", "error");
      }
    });
  }

  function onDragCancel() {
    setActiveId(null);
    setTasks((curr) => [...curr]);
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const t = tasks.find((x) => x.id === active.id);
      return t ? `Picked up task ${t.title}. Use arrow keys to move, space to drop.` : `Picked up task.`;
    },
    onDragOver({ active, over }) {
      if (!over) return undefined;
      const t = tasks.find((x) => x.id === active.id);
      if ((knownStatuses as readonly string[]).includes(String(over.id))) {
        const col = columns.find((c) => c.status === (over.id as TaskStatus));
        return `Task ${t?.title ?? ""} over column ${col?.label ?? over.id}.`;
      }
      const overCard = tasks.find((x) => x.id === over.id);
      return `Task ${t?.title ?? ""} over ${overCard?.title ?? "another task"}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `Task drop cancelled — returned to its starting column.`;
      const t = tasks.find((x) => x.id === active.id);
      const col = columns.find((c) => c.status === t?.status);
      return `Task ${t?.title ?? ""} dropped into ${col?.label ?? t?.status ?? ""}.`;
    },
    onDragCancel({ active }) {
      const t = tasks.find((x) => x.id === active.id);
      return `Drag cancelled. Task ${t?.title ?? ""} returned to its starting position.`;
    },
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {byStatus.map((col) => (
          <BoardColumn
            key={col.status}
            column={col}
            isDragging={activeId !== null}
            canEdit={canMove}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeTask ? (
          <div className="rotate-1 scale-[1.02] cursor-grabbing shadow-2xl">
            <CardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
      <SavingBadge visible={pending} />
    </DndContext>
  );
}

function BoardColumn({
  column,
  isDragging,
  canEdit,
}: {
  column: Column & { items: TaskWithRelations[] };
  isDragging: boolean;
  canEdit: (t: TaskWithRelations) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const over = column.wipLimit && column.items.length > column.wipLimit;
  const pointSum = column.items.reduce((s, t) => s + (t.storyPoints ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[480px] flex-col gap-2 rounded-lg p-2 ring-1 transition-colors",
        column.tone,
        isOver && "ring-2 ring-black/60",
      )}
      role="group"
      aria-label={`${column.label} column — ${column.items.length} tasks`}
    >
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {column.label}
        </h2>
        <div className="flex items-center gap-1.5">
          {pointSum > 0 && (
            <span className="rounded bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-700">
              {pointSum} pts
            </span>
          )}
          <span
            className={cn(
              "rounded px-1.5 text-xs font-semibold",
              over ? "bg-black text-white" : "text-neutral-500",
            )}
          >
            {column.items.length}
            {column.wipLimit ? `/${column.wipLimit}` : ""}
          </span>
        </div>
      </div>

      <SortableContext
        items={column.items.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {column.items.length === 0 ? (
            <EmptyHint isOver={isOver} isDragging={isDragging} />
          ) : (
            column.items.map((t) => (
              <SortableCard key={t.id} task={t} canMove={canEdit(t)} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function EmptyHint({ isOver, isDragging }: { isOver: boolean; isDragging: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center rounded border border-dashed py-10 text-center text-xs",
        isOver ? "border-black text-black" : "border-neutral-200 text-neutral-400",
        !isDragging && "opacity-60",
      )}
    >
      {isDragging ? "Drop here" : "Empty"}
    </div>
  );
}

function SortableCard({ task, canMove }: { task: TaskWithRelations; canMove: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !canMove });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none",
        canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging && "opacity-30",
      )}
      aria-label={
        canMove
          ? `Task ${task.title}, status ${task.status}. Press space to grab.`
          : `Task ${task.title}, status ${task.status}. Drag locked — you're not the reporter or assignee.`
      }
    >
      <CardBody task={task} locked={!canMove} />
    </div>
  );
}

function CardBody({ task, locked }: { task: TaskWithRelations; locked?: boolean }) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
  return (
    <div
      className={cn(
        "rounded-md border border-black/10 bg-white p-3 shadow-sm transition hover:border-black/30 hover:shadow-md",
        locked && "opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-black">{task.title}</p>
        {locked && (
          <span title="You can't move this card" aria-hidden>
            <Lock className="h-3.5 w-3.5 text-neutral-400" />
          </span>
        )}
      </div>
      {task.project && (
        <Link
          href={`/dashboard/projects/${task.project.id}`}
          onPointerDown={(e) => e.stopPropagation()}
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

function SavingBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-black/15 bg-white px-3 py-1 text-xs text-neutral-700 shadow"
    >
      Saving…
    </p>
  );
}

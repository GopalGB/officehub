"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lock } from "lucide-react";
import type { Project, ProjectStatus, User } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "./StatusBadge";
import { useToast } from "@/components/ui/toast";
import { moveProject } from "@/app/dashboard/actions";
import { formatDate, timeAgo, cn } from "@/lib/utils";
import { computePlacement } from "@/components/board/dnd-helpers";

const ORDER_STEP = 1024;

type ProjectWithOwner = Project & { owner: Pick<User, "id" | "name"> };
type Column = {
  status: ProjectStatus;
  label: string;
  tone: string; // pure-white-theme tailwind classes for column container
  wipLimit?: number;
};

export function ProjectBoardClient({
  columns,
  initialProjects,
  viewerId,
  canEditByOwner,
}: {
  columns: Column[];
  initialProjects: ProjectWithOwner[];
  viewerId: string;
  canEditByOwner: boolean;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const lastMoveRef = useRef<number>(0);
  // Snapshot of state at drag start — the correct target for every revert
  // (permission denied, dropped outside, cancelled). Never revert to the
  // mount-time `initialProjects`, which would undo earlier successful moves.
  const dragStartRef = useRef<ProjectWithOwner[]>(initialProjects);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space grabs/drops; Enter is freed so the focused card can navigate.
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] },
    }),
  );

  const knownStatuses = useMemo(() => columns.map((c) => c.status), [columns]);

  const byStatus = useMemo(() => {
    const sorted = [...projects].sort((a, b) => a.orderIndex - b.orderIndex);
    return columns.map((c) => ({ ...c, items: sorted.filter((p) => p.status === c.status) }));
  }, [columns, projects]);

  function canMove(p: ProjectWithOwner): boolean {
    return canEditByOwner || p.ownerId === viewerId;
  }

  function restoreFocus(cardId: string) {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`);
      node?.focus();
    });
  }

  function onDragStart(e: DragStartEvent) {
    dragStartRef.current = projects;
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    // Cross-column live preview: move the active card into the over column so
    // sibling reflows feel native (Jira/Trello-style).
    const activeIdStr = String(e.active.id);
    const overIdStr = e.over ? String(e.over.id) : null;
    if (!overIdStr) return;

    setProjects((curr) => {
      const active = curr.find((p) => p.id === activeIdStr);
      if (!active) return curr;

      let targetStatus: ProjectStatus;
      if ((knownStatuses as readonly string[]).includes(overIdStr)) {
        targetStatus = overIdStr as ProjectStatus;
      } else {
        const over = curr.find((p) => p.id === overIdStr);
        if (!over) return curr;
        targetStatus = over.status;
      }

      if (active.status === targetStatus) return curr;
      return curr.map((p) => (p.id === activeIdStr ? { ...p, status: targetStatus } : p));
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    // Dropped outside any column: undo the onDragOver preview.
    if (!over) {
      setProjects(dragStartRef.current);
      return;
    }

    const projectId = String(active.id);
    const overId = String(over.id);

    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (!canMove(project)) {
      setProjects(dragStartRef.current);
      toast("You can't move someone else's project", "error");
      return;
    }

    // Determine target status + neighbour card
    let toStatus: ProjectStatus;
    let targetCardId: string | null = null;
    let placement: "above" | "below" = "below";

    if ((knownStatuses as readonly string[]).includes(overId)) {
      toStatus = overId as ProjectStatus;
    } else {
      const overCard = projects.find((p) => p.id === overId);
      if (!overCard) {
        setProjects(dragStartRef.current);
        return;
      }
      toStatus = overCard.status;
      targetCardId = overId;
      placement = computePlacement(active, over);
    }

    const previousProjects = dragStartRef.current;

    // WIP-limit warning (informational only, not blocking)
    const col = columns.find((c) => c.status === toStatus);
    const newColCount = projects.filter((p) => p.status === toStatus && p.id !== projectId).length + 1;
    if (col?.wipLimit && newColCount > col.wipLimit) {
      toast(`WIP limit exceeded in ${col.label} (${newColCount}/${col.wipLimit})`, "info");
    }

    // Optimistic reorder that mirrors the server's neighbour+placement math:
    // build the destination column WITHOUT the dragged card, insert at the
    // target index, then re-spread orderIndex by visual order.
    setProjects((curr) => {
      const moved = curr.find((p) => p.id === projectId);
      if (!moved) return curr;
      const colItems = curr
        .filter((p) => p.id !== projectId && p.status === toStatus)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      let insertAt = colItems.length;
      if (targetCardId) {
        const ti = colItems.findIndex((p) => p.id === targetCardId);
        if (ti >= 0) insertAt = ti + (placement === "above" ? 0 : 1);
      }
      const ordered = [
        ...colItems.slice(0, insertAt),
        { ...moved, status: toStatus },
        ...colItems.slice(insertAt),
      ];
      const spread = new Map(ordered.map((p, i) => [p.id, i * ORDER_STEP]));
      return curr.map((p) => {
        if (p.id === projectId) return { ...p, status: toStatus, orderIndex: spread.get(p.id) ?? p.orderIndex };
        return spread.has(p.id) ? { ...p, orderIndex: spread.get(p.id)! } : p;
      });
    });
    restoreFocus(projectId);

    const moveAt = ++lastMoveRef.current;
    start(async () => {
      try {
        await moveProject({ projectId, toStatus, targetCardId, placement });
        if (moveAt === lastMoveRef.current) {
          toast(`Moved to ${col?.label ?? toStatus}`, "success");
        }
      } catch (err) {
        setProjects(previousProjects);
        toast(err instanceof Error ? err.message : "Could not move project", "error");
      }
    });
  }

  function onDragCancel() {
    setActiveId(null);
    setProjects(dragStartRef.current);
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const p = projects.find((x) => x.id === active.id);
      return p ? `Picked up project ${p.title}. Use arrow keys to move, space to drop.` : `Picked up project.`;
    },
    onDragOver({ active, over }) {
      if (!over) return undefined;
      const p = projects.find((x) => x.id === active.id);
      if ((knownStatuses as readonly string[]).includes(String(over.id))) {
        const col = columns.find((c) => c.status === (over.id as ProjectStatus));
        return `Project ${p?.title ?? ""} over column ${col?.label ?? over.id}.`;
      }
      const overCard = projects.find((x) => x.id === over.id);
      return `Project ${p?.title ?? ""} over ${overCard?.title ?? "another project"}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `Project drop cancelled — returned to its starting column.`;
      const p = projects.find((x) => x.id === active.id);
      const col = columns.find((c) => c.status === p?.status);
      return `Project ${p?.title ?? ""} dropped into ${col?.label ?? p?.status ?? ""}.`;
    },
    onDragCancel({ active }) {
      const p = projects.find((x) => x.id === active.id);
      return `Drag cancelled. Project ${p?.title ?? ""} returned to its starting position.`;
    },
  };

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;

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
        {activeProject ? (
          <div className="rotate-1 scale-[1.02] cursor-grabbing shadow-2xl">
            <CardBody project={activeProject} overlay />
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
  column: Column & { items: ProjectWithOwner[] };
  isDragging: boolean;
  canEdit: (p: ProjectWithOwner) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const over = column.wipLimit && column.items.length > column.wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[480px] flex-col gap-2 rounded-lg p-2 ring-1 transition-colors",
        column.tone,
        isOver && "ring-2 ring-black/60",
      )}
      role="group"
      aria-label={`${column.label} column — ${column.items.length} projects`}
    >
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {column.label}
        </h2>
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

      <SortableContext
        items={column.items.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {column.items.length === 0 ? (
            <EmptyHint isOver={isOver} isDragging={isDragging} />
          ) : (
            column.items.map((p) => (
              <SortableCard key={p.id} project={p} canMove={canEdit(p)} />
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
      {isDragging ? "Drop here" : "No projects"}
    </div>
  );
}

function SortableCard({ project, canMove }: { project: ProjectWithOwner; canMove: boolean }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !canMove });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  const href = `/dashboard/projects/${project.id}`;

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter opens the project (Space is reserved for grab/drop by the sensor).
    if (e.key === "Enter" && !isDragging) {
      e.preventDefault();
      router.push(href);
      return;
    }
    listeners?.onKeyDown?.(e as unknown as KeyboardEvent);
  }

  return (
    <div
      ref={setNodeRef}
      data-card-id={project.id}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      className={cn(
        canMove ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        // Allow vertical scroll on touch when idle; lock gestures only mid-drag.
        isDragging ? "touch-none opacity-30" : "touch-pan-y",
      )}
      aria-label={
        canMove
          ? `Project ${project.title}, status ${project.status}. Press space to grab, enter to open.`
          : `Project ${project.title}, status ${project.status}. Drag locked — you don't own this project. Press enter to open.`
      }
    >
      <CardBody project={project} locked={!canMove} />
    </div>
  );
}

function CardBody({
  project,
  locked,
  overlay,
}: {
  project: ProjectWithOwner;
  locked?: boolean;
  overlay?: boolean;
}) {
  const overdue =
    project.targetDate &&
    new Date(project.targetDate) < new Date() &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);
  return (
    <div
      className={cn(
        "block rounded-md border border-black/10 bg-white p-3 shadow-sm transition hover:border-black/30 hover:shadow-md",
        locked && "opacity-90",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {overlay ? (
          <span className="line-clamp-2 text-sm font-semibold text-black">{project.title}</span>
        ) : (
          <Link
            href={`/dashboard/projects/${project.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            tabIndex={-1}
            className="line-clamp-2 text-sm font-semibold text-black hover:underline"
          >
            {project.title}
          </Link>
        )}
        {locked && (
          <span title="You can't move this card" aria-hidden>
            <Lock className="h-3.5 w-3.5 text-neutral-400" />
          </span>
        )}
      </div>
      {project.summary && (
        <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{project.summary}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Avatar name={project.owner.name} size="sm" />
          <PriorityBadge priority={project.priority} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
        <span
          className={
            overdue ? "font-semibold text-black underline decoration-2 underline-offset-2" : ""
          }
        >
          {project.targetDate ? `Target ${formatDate(project.targetDate)}` : "No target"}
          {overdue && " · overdue"}
        </span>
        <span>{timeAgo(project.updatedAt)}</span>
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

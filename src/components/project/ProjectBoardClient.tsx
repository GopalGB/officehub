"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lock, GripVertical, Download } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "./StatusBadge";
import { useToast } from "@/components/ui/toast";
import { moveProject } from "@/app/dashboard/actions";
import { formatDate, timeAgo, cn, isOverdueDate } from "@/lib/utils";
import {
  computePlacement,
  restrictOverlayToViewport,
} from "@/components/board/dnd-helpers";
import { projectBoardCSV, type BoardProject } from "@/lib/project-csv";
import { Button } from "@/components/ui/button";

const ORDER_STEP = 1024;

type ProjectWithOwner = BoardProject;
type Column = {
  status: ProjectStatus;
  label: string;
  tone: string; // pure-white-theme tailwind classes for column container
  wipLimit?: number;
};

/** Portal fixed drag feedback outside transformed page ancestors and reuse scoped data. */
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
  const boardRef = useRef<HTMLDivElement>(null);
  const focusAfterSaveRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!activeId && !pending) {
      setProjects(initialProjects);
      if (focusAfterSaveRef.current) {
        restoreFocus(focusAfterSaveRef.current);
        focusAfterSaveRef.current = null;
      }
    }
  }, [initialProjects, activeId, pending]);
  // Snapshot of state at drag start — the correct target for every revert
  // (permission denied, dropped outside, cancelled). Never revert to the
  // mount-time `initialProjects`, which would undo earlier successful moves.
  const dragStartRef = useRef<ProjectWithOwner[]>(initialProjects);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space grabs/drops; Enter is freed so the focused card can navigate.
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space],
      },
    }),
  );

  const knownStatuses = useMemo(() => columns.map((c) => c.status), [columns]);
  /** Pointer proximity alone must not turn an outside drop into an implicit move. */
  const collisions: CollisionDetection = (args) => {
    if (!args.pointerCoordinates) return closestCorners(args);
    const board = boardRef.current?.getBoundingClientRect();
    const { x, y } = args.pointerCoordinates;
    if (
      !board ||
      x < board.left ||
      x > board.right ||
      y < board.top ||
      y > board.bottom
    )
      return [];
    const hits = pointerWithin(args);
    const cards = hits.filter(
      (hit) => !knownStatuses.includes(hit.id as ProjectStatus),
    );
    return cards.length ? cards : hits;
  };

  const byStatus = useMemo(() => {
    const sorted = [...projects].sort((a, b) => a.orderIndex - b.orderIndex);
    return columns.map((c) => ({
      ...c,
      items: sorted.filter((p) => p.status === c.status),
    }));
  }, [columns, projects]);

  /** Honor the server's roster-aware permission rather than testing ownership alone. */
  function canMove(p: ProjectWithOwner): boolean {
    return p.canEdit ?? (canEditByOwner || p.ownerId === viewerId);
  }

  /** Reparenting recreates handles, so focus after the DOM has settled. */
  function restoreFocus(cardId: string) {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const node = document.querySelector<HTMLElement>(
        `[data-move-handle="${cardId}"]`,
      );
      node?.focus();
    });
  }

  /** Snapshot this drag so cancellation cannot undo an earlier successful save. */
  function onDragStart(e: DragStartEvent) {
    dragStartRef.current = projects;
    setActiveId(String(e.active.id));
  }

  /** Preview column changes locally; the server receives only the final drop. */
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
      return curr.map((p) =>
        p.id === activeIdStr ? { ...p, status: targetStatus } : p,
      );
    });
  }

  /** Reconcile optimistic order with the authorized server write, rolling back failures. */
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    // Dropped outside any column: undo the onDragOver preview.
    if (!over) {
      setProjects(dragStartRef.current);
      restoreFocus(String(active.id));
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

    if (overId === projectId) {
      const original = dragStartRef.current.find(
        (item) => item.id === projectId,
      );
      if (original?.status === project.status) {
        setProjects(dragStartRef.current);
        restoreFocus(projectId);
        return;
      }
      toStatus = project.status;
    } else if ((knownStatuses as readonly string[]).includes(overId)) {
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
    const newColCount =
      projects.filter((p) => p.status === toStatus && p.id !== projectId)
        .length + 1;
    if (col?.wipLimit && newColCount > col.wipLimit) {
      toast(
        `WIP limit exceeded in ${col.label} (${newColCount}/${col.wipLimit})`,
        "info",
      );
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
        if (p.id === projectId)
          return {
            ...p,
            status: toStatus,
            orderIndex: spread.get(p.id) ?? p.orderIndex,
          };
        return spread.has(p.id) ? { ...p, orderIndex: spread.get(p.id)! } : p;
      });
    });
    restoreFocus(projectId);
    focusAfterSaveRef.current = projectId;

    const moveAt = ++lastMoveRef.current;
    start(async () => {
      try {
        await moveProject({ projectId, toStatus, targetCardId, placement });
        if (moveAt === lastMoveRef.current) {
          toast(`Moved to ${col?.label ?? toStatus}`, "success");
        }
      } catch (err) {
        setProjects(previousProjects);
        toast(
          err instanceof Error ? err.message : "Could not move project",
          "error",
        );
      }
    });
  }

  /** Escape restores the latest snapshot and preserves the user's keyboard location. */
  function onDragCancel() {
    if (activeId) restoreFocus(activeId);
    setActiveId(null);
    setProjects(dragStartRef.current);
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const p = projects.find((x) => x.id === active.id);
      return p
        ? `Picked up project ${p.title}. Use arrow keys to move, space to drop.`
        : `Picked up project.`;
    },
    onDragOver({ active, over }) {
      if (!over) return undefined;
      const p = projects.find((x) => x.id === active.id);
      if ((knownStatuses as readonly string[]).includes(String(over.id))) {
        const col = columns.find(
          (c) => c.status === (over.id as ProjectStatus),
        );
        return `Project ${p?.title ?? ""} over column ${col?.label ?? over.id}.`;
      }
      const overCard = projects.find((x) => x.id === over.id);
      return `Project ${p?.title ?? ""} over ${overCard?.title ?? "another project"}.`;
    },
    onDragEnd({ active, over }) {
      if (!over)
        return `Project drop cancelled — returned to its starting column.`;
      const p = projects.find((x) => x.id === active.id);
      const col = columns.find((c) => c.status === p?.status);
      return `Project ${p?.title ?? ""} dropped into ${col?.label ?? p?.status ?? ""}.`;
    },
    onDragCancel({ active }) {
      const p = projects.find((x) => x.id === active.id);
      return `Drag cancelled. Project ${p?.title ?? ""} returned to its starting position.`;
    },
  };

  const activeProject = activeId
    ? projects.find((p) => p.id === activeId)
    : null;

  /** Export the current confirmed board rather than fetching a broader dataset. */
  function exportCSV() {
    try {
      const csv = projectBoardCSV(
        [...projects].sort(
          (a, b) =>
            columns.findIndex((column) => column.status === a.status) -
              columns.findIndex((column) => column.status === b.status) ||
            a.orderIndex - b.orderIndex,
        ),
      );
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `officehub-project-board-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Exported ${projects.length} projects`, "success");
    } catch {
      toast("Could not export this board. Reload and try again.", "error");
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {projects.length} projects shown · CSV follows the current filters.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={pending || !!activeId || !projects.length}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisions}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements }}
      >
        <div
          ref={boardRef}
          data-project-board
          className="max-w-full overflow-x-auto rounded-xl p-1 pb-3"
        >
          <div className="grid grid-flow-col auto-cols-[260px] items-start gap-3">
            {byStatus.map((col) => (
              <BoardColumn
                key={col.status}
                column={col}
                isDragging={activeId !== null}
                canEdit={canMove}
                saving={pending}
              />
            ))}
          </div>
        </div>
        {mounted &&
          createPortal(
            <DragOverlay
              modifiers={[restrictOverlayToViewport]}
              dropAnimation={
                reduceMotion ? null : { duration: 180, easing: "ease-out" }
              }
            >
              {activeProject ? (
                <div
                  data-project-drag-preview
                  className="cursor-grabbing shadow-xl"
                >
                  <CardBody
                    project={activeProject}
                    overlay
                    handle={
                      <span
                        className="shrink-0 rounded p-1 text-muted-foreground"
                        aria-hidden="true"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    }
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        <SavingBadge visible={pending} />
      </DndContext>
    </div>
  );
}

/** Bound long lists so completed work cannot push every other column off-screen. */
function BoardColumn({
  column,
  isDragging,
  canEdit,
  saving,
}: {
  column: Column & { items: ProjectWithOwner[] };
  isDragging: boolean;
  canEdit: (p: ProjectWithOwner) => boolean;
  saving: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const over = column.wipLimit && column.items.length > column.wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-[min(65dvh,640px)] min-h-[320px] min-w-0 flex-col gap-2 rounded-lg p-2 ring-1 transition-colors",
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
        <div
          data-project-column-scroll
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto px-px pb-1"
        >
          {column.items.length === 0 ? (
            <EmptyHint isOver={isOver} isDragging={isDragging} />
          ) : (
            column.items.map((p) => (
              <SortableCard
                key={p.id}
                project={p}
                canMove={canEdit(p)}
                saving={saving}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function EmptyHint({
  isOver,
  isDragging,
}: {
  isOver: boolean;
  isDragging: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center rounded border border-dashed py-10 text-center text-xs",
        isOver
          ? "border-black text-black"
          : "border-neutral-200 text-neutral-400",
        !isDragging && "opacity-60",
      )}
    >
      {isDragging ? "Drop here" : "No projects"}
    </div>
  );
}

/** Separate move gestures from links and touch scrolling with an explicit handle. */
function SortableCard({
  project,
  canMove,
  saving,
}: {
  project: ProjectWithOwner;
  canMove: boolean;
  saving: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !canMove || saving });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      data-card-id={project.id}
      style={style}
      className={cn("relative min-w-0 touch-pan-y", isDragging && "opacity-30")}
      aria-label={
        canMove
          ? `Project ${project.title}, status ${project.status}. Press space to grab, enter to open.`
          : `Project ${project.title}, status ${project.status}. Drag locked — you don't own this project. Press enter to open.`
      }
    >
      <CardBody
        project={project}
        locked={!canMove}
        handle={
          canMove ? (
            <button
              type="button"
              disabled={saving}
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              data-move-handle={project.id}
              aria-label={`Move project ${project.title}`}
              title="Drag to move; Space then arrow keys also works"
              className="shrink-0 touch-none rounded p-1 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

/** Use matching card geometry for the normal card and the fixed drag preview. */
function CardBody({
  project,
  locked,
  overlay,
  handle,
}: {
  project: ProjectWithOwner;
  locked?: boolean;
  overlay?: boolean;
  handle?: React.ReactNode;
}) {
  const overdue =
    isOverdueDate(project.targetDate) &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);
  return (
    <div
      className={cn(
        "block min-w-0 rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        locked && "opacity-90",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        {overlay ? (
          <span className="min-w-0 line-clamp-2 break-words text-sm font-semibold text-foreground">
            {project.title}
          </span>
        ) : (
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="min-w-0 line-clamp-2 break-words text-sm font-semibold text-foreground hover:underline"
          >
            {project.title}
          </Link>
        )}
        {handle}
        {locked && (
          <span title="You can't move this card" aria-hidden>
            <Lock className="h-3.5 w-3.5 text-neutral-400" />
          </span>
        )}
      </div>
      {project.summary && (
        <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
          {project.summary}
        </p>
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
            overdue
              ? "font-semibold text-black underline decoration-2 underline-offset-2"
              : ""
          }
        >
          {project.targetDate
            ? `Target ${formatDate(project.targetDate)}`
            : "No target"}
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

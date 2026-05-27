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
import type { Project, ProjectStatus, User } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "./StatusBadge";
import { useToast } from "@/components/ui/toast";
import { quickUpdateProjectStatus } from "@/app/dashboard/actions";
import { formatDate, timeAgo, cn } from "@/lib/utils";

type ProjectWithOwner = Project & { owner: Pick<User, "id" | "name"> };
type Column = { status: ProjectStatus; label: string; ring: string };

export function ProjectBoardClient({
  columns,
  initialProjects,
  viewerId,
  canEditByOwner,
}: {
  columns: Column[];
  initialProjects: ProjectWithOwner[];
  viewerId: string;
  canEditByOwner: boolean; // true if viewer is manager+ (can move ANY card)
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function canMove(p: ProjectWithOwner): boolean {
    return canEditByOwner || p.ownerId === viewerId;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const projectId = String(e.active.id);
    const newStatus = String(e.over.id) as ProjectStatus;

    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (project.status === newStatus) return;
    if (!canMove(project)) {
      toast("You can't move someone else's project", "error");
      return;
    }

    // Optimistic update
    const prev = projects;
    setProjects(projects.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p)));

    start(async () => {
      try {
        await quickUpdateProjectStatus(projectId, newStatus);
        toast(`Moved to ${columns.find((c) => c.status === newStatus)?.label}`, "success");
      } catch (err) {
        setProjects(prev); // revert
        toast(err instanceof Error ? err.message : "Could not move project", "error");
      }
    });
  }

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;
  const byStatus = columns.map((c) => ({
    ...c,
    items: projects.filter((p) => p.status === c.status),
  }));

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {byStatus.map((col) => (
          <DroppableColumn key={col.status} column={col}>
            {col.items.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-neutral-400">No projects</p>
            ) : (
              col.items.map((p) => (
                <DraggableCard key={p.id} project={p} canMove={canMove(p)} />
              ))
            )}
          </DroppableColumn>
        ))}
      </div>
      <DragOverlay>
        {activeProject ? (
          <div className="rotate-2 cursor-grabbing opacity-90">
            <CardBody project={activeProject} />
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
  column: Column & { items: ProjectWithOwner[] };
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

function DraggableCard({ project, canMove }: { project: ProjectWithOwner; canMove: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
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
      <CardBody project={project} />
    </div>
  );
}

function CardBody({ project }: { project: ProjectWithOwner }) {
  const overdue =
    project.targetDate &&
    new Date(project.targetDate) < new Date() &&
    !["COMPLETED", "ARCHIVED"].includes(project.status);
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      onClick={(e) => e.stopPropagation()}
      className="block rounded-md border border-black/10 bg-white p-3 shadow-sm transition hover:border-black/30 hover:shadow-md"
    >
      <p className="line-clamp-2 text-sm font-semibold text-black">{project.title}</p>
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
    </Link>
  );
}

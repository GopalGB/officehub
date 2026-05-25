import type { Milestone, ProjectUpdate, Project, User } from "@prisma/client";
import {
  Sparkles,
  Flag,
  CircleDot,
  CalendarClock,
  CalendarCheck,
  MessageSquare,
  PlayCircle,
} from "lucide-react";
import { formatDate, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  kind: "created" | "started" | "milestone" | "update" | "target" | "today" | "completed";
  date: Date;
  title: string;
  subtitle?: string | null;
  doneIcon?: boolean;
  overdue?: boolean;
  authorName?: string;
};

const ICONS = {
  created: Sparkles,
  started: PlayCircle,
  milestone: Flag,
  update: MessageSquare,
  target: CalendarClock,
  completed: CalendarCheck,
  today: CircleDot,
} as const;

// Monochrome — distinguished by fill (today/complete = solid black) vs outline.
const TONE_COMPLETE = "bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white";
const TONE_TARGET = "bg-neutral-100 text-black ring-black/30 dark:bg-neutral-900 dark:text-white dark:ring-white/30";
const TONE_OVERDUE = "bg-white text-black ring-2 ring-black dark:bg-black dark:text-white dark:ring-white";
const TONE_DEFAULT = "bg-neutral-100 text-neutral-700 ring-black/15 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-white/15";
const TONE_TODAY = "bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white";
const TONE_UPDATE = "bg-neutral-50 text-black ring-black/20 dark:bg-neutral-900 dark:text-white dark:ring-white/20";
const TONE_ACTIVE = "bg-neutral-100 text-black ring-black/25 dark:bg-neutral-900 dark:text-white dark:ring-white/25";

export function ProjectTimeline({
  project,
  milestones,
  updates,
}: {
  project: Project & { owner: Pick<User, "id" | "name" | "email"> };
  milestones: Milestone[];
  updates: (ProjectUpdate & { author: Pick<User, "id" | "name"> })[];
}) {
  const now = new Date();
  const events: Event[] = [];

  events.push({
    id: `created-${project.id}`,
    kind: "created",
    date: project.createdAt,
    title: "Project created",
    subtitle: `by ${project.owner.name}`,
  });

  if (project.startDate) {
    events.push({
      id: `started-${project.id}`,
      kind: "started",
      date: project.startDate,
      title: "Started",
    });
  }

  for (const m of milestones) {
    events.push({
      id: `m-${m.id}`,
      kind: "milestone",
      date: m.dueDate ?? m.createdAt,
      title: m.title,
      subtitle: m.completed
        ? m.completedAt
          ? `Completed ${formatDate(m.completedAt)}`
          : "Completed"
        : m.dueDate
        ? `Due ${formatDate(m.dueDate)}`
        : "No due date",
      doneIcon: m.completed,
      overdue: !!m.dueDate && !m.completed && new Date(m.dueDate) < now,
    });
  }

  // Last 5 status updates summarized
  const lastUpdates = updates.slice(0, 5).map((u) => ({
    id: `u-${u.id}`,
    kind: "update" as const,
    date: u.createdAt,
    title: `Status update`,
    subtitle: `by ${u.author.name}`,
    authorName: u.author.name,
  }));
  events.push(...lastUpdates);

  if (project.targetDate) {
    events.push({
      id: `target-${project.id}`,
      kind: "target",
      date: project.targetDate,
      title: "Target date",
      overdue:
        new Date(project.targetDate) < now &&
        !["COMPLETED", "ARCHIVED"].includes(project.status),
    });
  }

  if (project.actualEndDate || project.status === "COMPLETED") {
    events.push({
      id: `done-${project.id}`,
      kind: "completed",
      date: project.actualEndDate ?? project.updatedAt,
      title: "Project completed",
      doneIcon: true,
    });
  }

  // Sort chronological
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Insert "today" marker between the past and the future
  const firstFutureIdx = events.findIndex((e) => e.date > now);
  const todayEvent: Event = {
    id: "today",
    kind: "today",
    date: now,
    title: "Today",
    subtitle: formatDate(now),
  };
  if (firstFutureIdx === -1) {
    events.push(todayEvent);
  } else {
    events.splice(firstFutureIdx, 0, todayEvent);
  }

  if (events.length <= 1) {
    return (
      <p className="text-sm text-slate-400">
        Add a start date, target date, or milestones to populate the timeline.
      </p>
    );
  }

  return (
    <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-6">
      {events.map((e, i) => {
        const Icon = ICONS[e.kind];
        const tone =
          e.kind === "today"
            ? TONE_TODAY
            : e.kind === "completed" || e.doneIcon
            ? TONE_COMPLETE
            : e.kind === "target"
            ? e.overdue
              ? TONE_OVERDUE
              : TONE_TARGET
            : e.kind === "update"
            ? TONE_UPDATE
            : e.overdue
            ? TONE_OVERDUE
            : e.kind === "started"
            ? TONE_ACTIVE
            : TONE_DEFAULT;
        return (
          <li
            key={e.id}
            className="relative animate-fade-in"
            style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white",
                "ring-offset-0 shadow-sm",
                tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  e.kind === "today" ? "text-slate-900" : "text-slate-800",
                  e.overdue && e.kind !== "completed" ? "underline decoration-2 underline-offset-2" : "",
                )}
              >
                {e.title}
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(e.date)}
                {e.kind !== "today" && (
                  <span className="ml-1 text-slate-400">· {timeAgo(e.date)}</span>
                )}
              </p>
            </div>
            {e.subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{e.subtitle}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

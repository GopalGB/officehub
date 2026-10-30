"use client";
import { useState, type ReactNode } from "react";
import {
  chronologicalStages,
  isCompletedStage,
  timelineBarPosition,
} from "@/lib/timeline";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import { fiscalLabel, type FiscalConfig } from "@/lib/fiscal";
type Stage = {
  id: string;
  title: string;
  status: string;
  kind: "Original delivery" | "Enhancement" | "Linked project";
  start: string;
  end: string;
  loggedAt: string;
  hasStart: boolean;
  hasEnd: boolean;
  endLabel: string;
  invalidRange: boolean;
  scheduled: boolean;
  href?: string;
};
export function ProjectJourney({
  stages,
  milestones,
  fiscalConfigs = [],
  controls,
}: {
  stages: Stage[];
  milestones: { id: string; title: string; date: string; completed: boolean }[];
  fiscalConfigs?: FiscalConfig[];
  controls?: ReactNode;
}) {
  const [filter, setFilter] = useState("all");
  const [replay, setReplay] = useState(0);
  const complete = isCompletedStage;
  const ordered = chronologicalStages(stages);
  const completed = stages.filter((stage) => complete(stage.status)).length;
  const visible = chronologicalStages(
    stages.filter(
      (s) =>
        filter === "all" ||
        (filter === "completed"
          ? complete(s.status)
          : !complete(s.status) && s.status !== "REJECTED"),
    ),
  );
  const dates = [
    ...stages
      .filter((stage) => stage.scheduled && !stage.invalidRange)
      .flatMap((s) => [new Date(s.start).getTime(), new Date(s.end).getTime()]),
    ...milestones.map((m) => new Date(m.date).getTime()),
  ];
  const min = dates.length ? Math.min(...dates) : Date.now(),
    max = Math.max(...dates, min + 7 * 86400000);
  const span = Math.max(max - min, 7 * 86400000);
  const position = (date: string) =>
    Math.min(100, Math.max(0, ((new Date(date).getTime() - min) / span) * 100));
  const today = ((Date.now() - min) / span) * 100;
  const barStyle = (stage: Stage) => {
    const geometry = timelineBarPosition(stage.start, stage.end, min, span);
    return { left: `${geometry.left}%`, width: `${geometry.width}%` };
  };
  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Project timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Original delivery and every requested change, on one timeline.
            Changes can overlap the original work or follow delivery.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReplay((value) => value + 1)}
            className="motion-reduce:hidden inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-secondary"
            aria-label="Replay project timeline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Replay
          </button>
          <div className="flex rounded-lg border bg-secondary p-1 text-xs">
            {["all", "active", "completed"].map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 capitalize",
                  filter === f && "bg-card font-semibold shadow-sm",
                )}
              >
                {f === "all" ? "All stages" : f}
              </button>
            ))}
          </div>
        </div>
      </div>
      <section
        className="min-w-0 rounded-xl border bg-secondary/30 p-4"
        aria-label="Project delivery progress"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold">
            {completed} of {stages.length} stages completed
          </p>
          <span className="text-xs text-muted-foreground">
            Original delivery → requested changes
          </span>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label="Completed project stages"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, stages.length)}
          aria-valuenow={completed}
        >
          <div
            key={replay}
            className="journey-draw h-full rounded-full bg-brand-orange"
            style={{
              width: `${stages.length ? (completed / stages.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="mt-4 max-w-full overflow-x-auto pb-2">
          <ol
            key={replay}
            className="flex min-w-max gap-3"
            aria-label="Project delivery stages"
          >
            {ordered.map((stage, index) => (
              <li
                key={stage.id}
                className="journey-stage w-44 shrink-0 rounded-lg border bg-card p-3"
                style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  {complete(stage.status) ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-brand-orange" />
                  )}
                  <span>
                    {index === 0 && stage.kind === "Original delivery"
                      ? "Original delivery"
                      : `Stage ${index + 1}`}
                  </span>
                </div>
                <p
                  className="mt-2 line-clamp-2 break-words text-xs font-semibold"
                  title={stage.title}
                >
                  {stage.href ? (
                    <Link className="text-link" href={stage.href}>
                      {stage.title}
                    </Link>
                  ) : (
                    stage.title
                  )}
                </p>
                <p className="mt-2 text-[10px] capitalize text-muted-foreground">
                  {stage.status.toLowerCase().replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {stage.scheduled && stage.hasEnd
                    ? `${stage.endLabel} ${formatDate(stage.end)}`
                    : stage.scheduled && stage.hasStart
                      ? `Starts ${formatDate(stage.start)}`
                      : "Dates not set"}
                </p>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Stages show the original work and its recorded changes. The schedule
          below uses the dates you enter; undated stages stay unscheduled.
        </p>
      </section>
      {controls}
      <p className="text-xs text-muted-foreground">
        {stages.filter((stage) => stage.kind === "Enhancement").length} changes
        / enhancements ·{" "}
        {stages.filter((stage) => complete(stage.status)).length} completed
        stages
      </p>
      {!dates.length && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {stages.some((stage) => stage.scheduled && stage.invalidRange)
            ? "Scheduled dates need correction. Check the start and end dates below."
            : "No dates scheduled yet. Add the project start and deadline, or add a dated change, to plot its duration."}
        </p>
      )}
      <p className="text-xs text-muted-foreground sm:hidden">
        Scroll the timeline horizontally to see all dates.
      </p>
      <div
        className="max-w-full overflow-x-auto pb-2"
        aria-label="Project timeline schedule"
      >
        <div key={`${filter}:${replay}`} className="min-w-[600px]">
          <div className="ml-52 flex justify-between border-b pb-2 text-[10px] text-muted-foreground">
            {dates.length > 0 &&
              Array.from({ length: 5 }, (_, i) => (
                <span key={i}>
                  {formatDate(new Date(min + (span * i) / 4))}
                </span>
              ))}
          </div>
          {visible.map((s, index) => (
            <div
              key={s.id}
              className="journey-stage grid grid-cols-[208px_minmax(0,1fr)] items-center border-b border-border/60 py-4"
              style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
            >
              <div className="min-w-0 pr-4">
                <p className="truncate text-sm font-medium" title={s.title}>
                  {s.href ? (
                    <Link className="text-link" href={s.href}>
                      {s.title}
                    </Link>
                  ) : (
                    s.title
                  )}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {s.kind} · {s.status.toLowerCase().replaceAll("_", " ")}
                </p>
              </div>
              <div className="min-w-0">
                <div
                  className="relative h-8 overflow-hidden rounded-md bg-secondary/70"
                  title={
                    s.scheduled
                      ? `${s.title}: ${formatDate(s.start)} to ${formatDate(s.end)}`
                      : `${s.title}: dates not scheduled`
                  }
                >
                  {s.scheduled && today >= 0 && today <= 100 && (
                    <span
                      className="absolute inset-y-0 z-10 border-l-2 border-dashed border-brand-orange/50"
                      style={{ left: `${today}%` }}
                    />
                  )}
                  {!s.scheduled || s.invalidRange ? (
                    <span className="absolute inset-1 flex items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">
                      {s.invalidRange
                        ? "Check start and end dates"
                        : "Not scheduled"}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "journey-draw absolute top-1 h-6 rounded-md",
                        complete(s.status)
                          ? "bg-brand-navy"
                          : s.status === "REJECTED"
                            ? "bg-muted-foreground"
                            : s.kind === "Original delivery"
                              ? "bg-brand-navy"
                              : "bg-brand-orange",
                      )}
                      style={{
                        ...barStyle(s),
                        animationDelay: `${Math.min(index * 45, 360)}ms`,
                      }}
                    />
                  )}
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {s.scheduled
                    ? s.hasStart && s.hasEnd
                      ? `${formatDate(s.start)} → ${formatDate(s.end)}`
                      : s.hasStart
                        ? `Starts ${formatDate(s.start)} · deadline not set`
                        : `${s.endLabel} ${formatDate(s.end)} · start not set`
                    : `Logged ${formatDate(s.loggedAt)} · dates not scheduled`}
                  {s.scheduled &&
                    ` · ${fiscalLabel(new Date(s.start), fiscalConfigs)}`}
                </p>
              </div>
            </div>
          ))}
          {!visible.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stages match this view.
            </p>
          )}
          {!!milestones.length && (
            <div className="grid grid-cols-[208px_1fr] py-4">
              <p className="text-xs font-medium">Delivery milestones</p>
              <div className="relative h-8">
                {milestones.map((m) => (
                  <span
                    key={m.id}
                    className="absolute top-0 text-lg"
                    style={{ left: `${Math.min(97, position(m.date))}%` }}
                    title={`${m.title} · ${formatDate(m.date)} · ${m.completed ? "Completed" : "Pending"}`}
                    aria-label={`${m.title}, ${formatDate(m.date)}, ${m.completed ? "completed" : "pending"}`}
                  >
                    {m.completed ? "◆" : "◇"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-brand-navy" />
          Original delivery
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-brand-orange" />
          Enhancement
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-brand-navy" />
          Completed
        </span>
        <span>┊ Today</span>
      </div>
    </div>
  );
}

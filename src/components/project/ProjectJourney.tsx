"use client";
import { useState, type ReactNode } from "react";
import { chronologicalStages } from "@/lib/timeline";
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
  const complete = (status: string) =>
    ["DONE", "COMPLETED", "ARCHIVED"].includes(status);
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
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Project timeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Original delivery and every requested change, on one timeline.
            Changes can overlap the original work or follow delivery.
          </p>
        </div>
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
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[600px]">
          <div className="ml-52 flex justify-between border-b pb-2 text-[10px] text-muted-foreground">
            {dates.length > 0 &&
              Array.from({ length: 5 }, (_, i) => (
                <span key={i}>
                  {formatDate(new Date(min + (span * i) / 4))}
                </span>
              ))}
          </div>
          {visible.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[208px_1fr] items-center border-b border-border/60 py-4"
            >
              <div className="pr-4">
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
              <div>
                <div
                  className="relative h-8 rounded-md bg-secondary/70"
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
                        "absolute top-1 h-6 min-w-2 rounded-md",
                        complete(s.status)
                          ? "bg-emerald-600 dark:bg-emerald-500"
                          : s.status === "REJECTED"
                            ? "bg-slate-400 dark:bg-slate-500"
                            : s.kind === "Original delivery"
                              ? "bg-brand-navy dark:bg-sky-400"
                              : "bg-brand-orange dark:bg-orange-400",
                      )}
                      style={{
                        left: `${Math.min(98, position(s.start))}%`,
                        width: `${Math.max(1, position(s.end) - position(s.start))}%`,
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
          <i className="h-2 w-2 rounded-full bg-brand-navy dark:bg-sky-400" />
          Original delivery
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-brand-orange dark:bg-orange-400" />
          Enhancement
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />
          Completed
        </span>
        <span>┊ Today</span>
      </div>
    </div>
  );
}

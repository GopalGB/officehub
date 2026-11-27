"use client";
import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, CircleDashed, ArrowLeftCircle } from "lucide-react";

export type GanttState = "UNSCHEDULED" | "ON_PLAN" | "SLIPPED" | "PULLED_IN" | "DONE_ON_TIME" | "DONE_LATE";

export type GanttRow = {
  id: string;
  title: string;
  href?: string;
  subtitle?: string;
  start: string | null; // ISO day
  end: string | null; // current target or completion
  baseline: string | null; // original target
  extensionEnd: string | null; // delivery including enhancements, when later than end
  state: GanttState;
  stateLabel: string;
  slipDays: number;
  extensionDays: number;
  reschedules: number;
  reasonText?: string;
};

// Status steps from the reference palette; always paired with an icon + label.
const STATE_STYLE: Record<GanttState, { bar: string; Icon: typeof Clock }> = {
  ON_PLAN: { bar: "#0084D4", Icon: Clock },
  PULLED_IN: { bar: "#0084D4", Icon: ArrowLeftCircle },
  SLIPPED: { bar: "#f18a59", Icon: AlertTriangle },
  DONE_ON_TIME: { bar: "#0aac23", Icon: CheckCircle2 },
  DONE_LATE: { bar: "#dc3c3d", Icon: AlertTriangle },
  UNSCHEDULED: { bar: "#c2c2c2", Icon: CircleDashed },
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    : "—";

/** Gantt rows: current schedule bar, original-target marker (dashed diamond)
 * joined to the current end when they differ, hatched enhancement extension,
 * and a today line. A deadline without a start is a point; no dates = text. */
export function ScheduleGantt({
  rows,
  min,
  max,
  ticks,
  today,
  labelWidth = 220,
}: {
  rows: GanttRow[];
  min: string;
  max: string;
  ticks: { at: string; label: string }[];
  today: string;
  labelWidth?: number;
}) {
  const [hover, setHover] = useState<{ row: GanttRow; x: number; y: number } | null>(null);
  const lo = Date.parse(min);
  const span = Math.max(Date.parse(max) - lo, 7 * 86_400_000);
  const pos = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - lo) / span) * 100));
  const todayPos = pos(today);
  const show = (row: GanttRow, el: Element) => {
    const r = el.getBoundingClientRect();
    setHover({ row, x: r.left + r.width / 2, y: r.top });
  };
  return (
    <div className="max-w-full overflow-x-auto" onMouseLeave={() => setHover(null)}>
      <div className="min-w-[680px]" style={{ ["--label" as string]: `${labelWidth}px` }}>
        <div className="grid grid-cols-[var(--label)_1fr] border-b border-slate-200 pb-1 text-[10px] text-slate-500">
          <span className="px-2">Project</span>
          <div className="relative h-4">
            {ticks.map((t) => (
              <span key={t.at} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(t.at)}%` }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <ul className="relative">
          {rows.map((row) => {
            const style = STATE_STYLE[row.state];
            const start = row.start ?? row.end;
            const invalid = !!(row.start && row.end && Date.parse(row.end) < Date.parse(row.start));
            const left = start && !invalid ? pos(start) : 0;
            const right = row.end && !invalid ? pos(row.end) : left;
            const width = Math.max(0, right - left);
            const point = !!row.end && (!row.start || width < 0.6);
            const showBaseline = row.baseline && row.end && row.baseline.slice(0, 10) !== row.end.slice(0, 10);
            return (
              <li
                key={row.id}
                className="grid grid-cols-[var(--label)_1fr] items-center border-b border-slate-100 hover:bg-slate-50"
              >
                <div className="min-w-0 px-2 py-1.5">
                  {row.href ? (
                    <Link href={row.href} className="block truncate text-xs font-medium text-slate-900 hover:underline">
                      {row.title}
                    </Link>
                  ) : (
                    <span className="block truncate text-xs font-medium">{row.title}</span>
                  )}
                  <span className="flex items-center gap-1 truncate text-[10px] text-slate-600">
                    <style.Icon className="h-3 w-3 shrink-0" style={{ color: style.bar }} aria-hidden="true" />
                    {row.stateLabel}
                    {row.slipDays !== 0 && row.state !== "UNSCHEDULED" && ` · ${row.slipDays > 0 ? "+" : ""}${row.slipDays}d`}
                    {row.subtitle && ` · ${row.subtitle}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="relative h-9 w-full cursor-default text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  aria-label={`${row.title}: ${row.stateLabel}. Start ${fmt(row.start)}, target ${fmt(row.end)}${showBaseline ? `, original target ${fmt(row.baseline)}` : ""}${row.extensionEnd ? `, with enhancements ${fmt(row.extensionEnd)}` : ""}.`}
                  onMouseEnter={(e) => show(row, e.currentTarget)}
                  onFocus={(e) => show(row, e.currentTarget)}
                  onBlur={() => setHover(null)}
                >
                  {ticks.map((t) => (
                    <span key={t.at} aria-hidden="true" className="absolute inset-y-0 w-px bg-slate-100" style={{ left: `${pos(t.at)}%` }} />
                  ))}
                  {!row.end && !row.start && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-slate-400">No dates yet</span>
                  )}
                  {invalid && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-brand-orange">
                      Dates need review (end before start)
                    </span>
                  )}
                  {showBaseline && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-0 border-t-2 border-dashed"
                      style={{
                        left: `${Math.min(pos(row.baseline!), pos(row.end!))}%`,
                        width: `${Math.abs(pos(row.end!) - pos(row.baseline!))}%`,
                        borderColor: style.bar,
                        opacity: 0.6,
                      }}
                    />
                  )}
                  {row.extensionEnd && row.end && !invalid && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-r"
                      style={{
                        left: `${right}%`,
                        width: `${Math.max(0.6, pos(row.extensionEnd) - right)}%`,
                        backgroundImage: "repeating-linear-gradient(45deg, #091F36 0 2px, transparent 2px 6px)",
                        opacity: 0.45,
                      }}
                    />
                  )}
                  {row.end && !invalid && !point && (() => {
                    // Delayed work: the original plan in blue, the extra time beyond
                    // the original target in the delay colour, so growth is visible.
                    const base = row.baseline ? pos(row.baseline) : -1;
                    const split = (row.state === "SLIPPED" || row.state === "DONE_LATE") && base > left && base < right;
                    return split ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-l"
                          style={{ left: `${left}%`, width: `${base - left}%`, background: STATE_STYLE.ON_PLAN.bar }}
                        />
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-r"
                          style={{ left: `calc(${base}% + 2px)`, width: `calc(${right - base}% - 2px)`, background: style.bar }}
                        />
                      </>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded"
                        style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%`, background: style.bar }}
                      />
                    );
                  })()}
                  {row.end && !invalid && point && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-white"
                      style={{ left: `${right}%`, background: style.bar }}
                    />
                  )}
                  {showBaseline && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-dashed bg-white"
                      style={{ left: `${pos(row.baseline!)}%`, borderColor: "#091F36" }}
                    />
                  )}
                </button>
              </li>
            );
          })}
          {todayPos > 0 && todayPos < 100 && (
            <li
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 grid grid-cols-[var(--label)_1fr]"
              style={{ left: 0, right: 0 }}
            >
              <span />
              <span className="relative">
                <span className="absolute inset-y-0 w-0.5 bg-brand-orange" style={{ left: `${todayPos}%` }} />
              </span>
            </li>
          )}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
          {(["ON_PLAN", "SLIPPED", "DONE_ON_TIME", "DONE_LATE"] as const).map((s) => {
            const { bar, Icon } = STATE_STYLE[s];
            return (
              <span key={s} className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-4 rounded" style={{ background: bar }} />
                <Icon className="h-3 w-3" style={{ color: bar }} aria-hidden="true" />
                {s === "ON_PLAN"
                  ? "Original plan / on plan"
                  : s === "SLIPPED"
                    ? "Delay beyond original target"
                    : s === "DONE_ON_TIME"
                      ? "Delivered on time"
                      : "Delivered late (delay)"}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rotate-45 border-2 border-dashed border-brand-navy bg-white" /> Original target
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-4 rounded opacity-45"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, #091F36 0 2px, transparent 2px 6px)" }}
            />
            Extended by enhancements
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-0.5 bg-brand-orange" /> Today
          </span>
        </div>
      </div>
      {hover && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(hover.x, 140), window.innerWidth - 140), top: hover.y - 6 }}
        >
          <p className="font-semibold text-slate-900">{hover.row.title}</p>
          <p className="mt-1 text-slate-600">{hover.row.stateLabel}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-slate-700">
            <dt>Start</dt>
            <dd>{fmt(hover.row.start)}</dd>
            <dt>Original target</dt>
            <dd>{fmt(hover.row.baseline)}</dd>
            <dt>Current target</dt>
            <dd>
              {fmt(hover.row.end)}
              {hover.row.slipDays !== 0 && ` (${hover.row.slipDays > 0 ? "+" : ""}${hover.row.slipDays} days)`}
            </dd>
            {hover.row.extensionEnd && (
              <>
                <dt>With enhancements</dt>
                <dd>
                  {fmt(hover.row.extensionEnd)} (+{hover.row.extensionDays} days)
                </dd>
              </>
            )}
            <dt>Reschedules</dt>
            <dd>{hover.row.reschedules}</dd>
          </dl>
          {hover.row.reasonText && <p className="mt-2 text-slate-600">Why: {hover.row.reasonText}</p>}
        </div>
      )}
    </div>
  );
}

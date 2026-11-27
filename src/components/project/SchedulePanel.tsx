import { ScheduleGantt, type GanttState } from "@/components/project/ScheduleGantt";
import { toGanttRow, ganttRange } from "@/lib/gantt";
import { reasonLabel, STATE_LABEL, dayKey, daysBetween } from "@/lib/schedule-metrics";
import type { ScheduleRow } from "@/lib/schedule-data";
import type { FiscalConfig } from "@/lib/fiscal";
import { localToday } from "@/lib/fiscal";
import { formatDate, formatDateTime } from "@/lib/utils";

type Change = {
  id: string;
  field: string;
  fromDate: Date | null;
  toDate: Date | null;
  reasonCategory: string | null;
  note: string | null;
  source: string;
  authorName: string;
  createdAt: Date;
  enhancementId: string | null;
};

/** Answers "is it late, by how much, and why?" for one project. */
export function SchedulePanel({
  row,
  changes,
  configs,
}: {
  row: ScheduleRow;
  changes: Change[];
  configs: FiscalConfig[];
}) {
  const s = row.summary;
  const projectRow = toGanttRow({ ...row, title: "Original delivery" });
  projectRow.href = undefined;
  projectRow.subtitle = undefined;
  const enhancementRows = row.enhancements
    .filter((e) => e.status !== "REJECTED" && (e.targetDate || e.startDate || e.completedAt))
    .map((e) => {
      const end = e.completedAt ?? e.targetDate;
      const firstMove = changes.find((c) => c.enhancementId === e.id && c.field === "TARGET" && c.fromDate);
      const baseline = firstMove?.fromDate ?? e.targetDate;
      const slip = baseline && e.targetDate ? daysBetween(baseline, e.targetDate) : 0;
      const done = e.status === "DONE";
      const state: GanttState = done ? (e.completedAt && e.targetDate && e.completedAt > e.targetDate ? "DONE_LATE" : "DONE_ON_TIME") : slip > 0 ? "SLIPPED" : "ON_PLAN";
      return {
        id: e.id,
        title: e.title,
        href: `?tab=enhancements#enhancement-${e.id}`,
        subtitle: "Enhancement",
        start: dayKey(e.startDate),
        end: dayKey(end),
        baseline: dayKey(baseline),
        extensionEnd: null,
        state,
        stateLabel: STATE_LABEL[state],
        slipDays: slip,
        extensionDays: 0,
        reschedules: changes.filter((c) => c.enhancementId === e.id && c.field === "TARGET" && c.fromDate).length,
      };
    });
  const rows = [projectRow, ...enhancementRows];
  const today = localToday();
  const range = ganttRange(rows, today, configs);
  const moves = changes.filter((c) => c.fromDate || c.field === "TARGET");
  const names = Object.fromEntries(row.enhancements.map((e) => [e.id, e.title]));
  const tiles: [string, string, string?][] = [
    [formatDate(s.baselineTarget), "Original target"],
    [formatDate(s.currentTarget), "Current target", s.slipDays ? `${s.slipDays > 0 ? "+" : ""}${s.slipDays} days vs original` : "Unchanged"],
    [String(s.reschedules), "Times rescheduled"],
    [
      s.completedAt ? formatDate(s.completedAt) : STATE_LABEL[s.state],
      s.completedAt ? "Delivered" : "Status",
      s.completedAt && s.lateVsTarget ? `${s.lateVsTarget > 0 ? `${s.lateVsTarget} days late` : `${-s.lateVsTarget} days early`}` : undefined,
    ],
    [
      s.enhancementExtensionDays ? formatDate(s.deliveryWithEnhancements) : "—",
      "Delivery with enhancements",
      s.enhancementExtensionDays ? `+${s.enhancementExtensionDays} days from enhancements` : "No extension",
    ],
  ];
  return (
    <section id="schedule" className="surface min-w-0 space-y-4 scroll-mt-24">
      <div>
        <h2 className="section-title">Schedule</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Original target against today&apos;s plan, every date change with its reason, and how enhancements extend delivery.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([value, label, note]) => (
          <div key={label} className="rounded-lg border border-slate-200 p-3">
            <p className="text-base font-semibold text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-600">{label}</p>
            {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
          </div>
        ))}
      </div>
      {rows.some((r) => r.start || r.end) && (
        <ScheduleGantt rows={rows} min={range.min} max={range.max} ticks={range.ticks} today={dayKey(today)!} labelWidth={170} />
      )}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date changes · {moves.length}</h3>
        <ol className="mt-2 space-y-2">
          {moves.map((c) => {
            const delta = c.fromDate && c.toDate ? daysBetween(c.fromDate, c.toDate) : null;
            return (
              <li key={c.id} className="rounded-lg border-l-4 border-slate-200 bg-slate-50 px-3 py-2 text-xs" style={{ borderLeftColor: delta && delta > 0 ? "#f18a59" : "#0084D4" }}>
                <p className="font-medium text-slate-900">
                  {c.enhancementId ? `Enhancement “${names[c.enhancementId] ?? "removed"}”` : "Project"}{" "}
                  {c.field === "TARGET" ? "target" : "start"}:{" "}
                  {c.fromDate ? `${formatDate(c.fromDate)} → ` : "set to "}
                  {c.toDate ? formatDate(c.toDate) : "removed"}
                  {delta ? ` (${delta > 0 ? "+" : ""}${delta} days)` : ""}
                </p>
                {c.fromDate && (
                  <p className="mt-0.5 text-slate-700">
                    Why: <strong>{reasonLabel(c.reasonCategory)}</strong>
                    {c.note ? ` — ${c.note}` : ""}
                  </p>
                )}
                <p className="mt-0.5 text-slate-500">
                  {c.authorName} · {formatDateTime(c.createdAt)} · {c.source}
                </p>
              </li>
            );
          })}
          {!moves.length && <li className="text-sm text-muted-foreground">No date changes yet.</li>}
        </ol>
      </div>
    </section>
  );
}

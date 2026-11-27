import type { GanttRow } from "@/components/project/ScheduleGantt";
import type { ScheduleRow } from "@/lib/schedule-data";
import { STATE_LABEL, reasonLabel, dayKey } from "@/lib/schedule-metrics";
import { fiscalWeeks, FISCAL_MONTH_NAMES, addDays, type FiscalConfig } from "@/lib/fiscal";

export function toGanttRow(row: ScheduleRow): GanttRow {
  const s = row.summary;
  const end = s.completedAt ?? s.currentTarget;
  const extension = s.enhancementExtensionDays > 0 ? s.deliveryWithEnhancements : null;
  const reasons = row.reasons
    .sort((a, b) => b.count - a.count)
    .map((r) => `${reasonLabel(r.reason)}${r.count > 1 ? ` ×${r.count}` : ""}`)
    .join(", ");
  return {
    id: row.id,
    title: row.title,
    href: `/dashboard/projects/${row.id}`,
    subtitle: [row.ownerName, row.brand].filter(Boolean).join(" · "),
    start: dayKey(row.startDate),
    end: dayKey(end),
    baseline: dayKey(s.baselineTarget),
    extensionEnd: dayKey(extension),
    state: s.state,
    stateLabel: STATE_LABEL[s.state],
    slipDays: s.slipDays,
    extensionDays: s.enhancementExtensionDays,
    reschedules: s.reschedules,
    reasonText: reasons || undefined,
  };
}

/** Visible range around all dates (plus today), padded, with fiscal-period ticks. */
export function ganttRange(rows: GanttRow[], today: Date, configs: FiscalConfig[] = []) {
  const all = rows
    .flatMap((r) => [r.start, r.end, r.baseline, r.extensionEnd])
    .filter((d): d is string => !!d)
    .map((d) => Date.parse(d));
  all.push(today.getTime());
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 60 * 86_400_000) {
    lo -= 30 * 86_400_000;
    hi += 30 * 86_400_000;
  }
  const pad = (hi - lo) * 0.03;
  const min = new Date(lo - pad);
  const max = new Date(hi + pad);
  const ticks: { at: string; label: string }[] = [];
  for (let fy = min.getUTCFullYear() - 1; fy <= max.getUTCFullYear() + 1; fy++) {
    for (const w of fiscalWeeks(fy, configs)) {
      if (w.monthWeek !== 1 || w.start < min || w.start > max) continue;
      // Fiscal period number, calendar month and calendar year of its first day.
      ticks.push({
        at: dayKey(w.start)!,
        label: `P${w.month} · ${FISCAL_MONTH_NAMES[w.month - 1].slice(0, 3)} '${String(w.start.getUTCFullYear()).slice(2)}`,
      });
    }
  }
  // Keep labels readable on long ranges: thin to at most ~12 ticks.
  const step = Math.max(1, Math.ceil(ticks.length / 12));
  return {
    min: dayKey(min)!,
    max: dayKey(addDays(max, 1))!,
    ticks: ticks.filter((_, i) => i % step === 0),
  };
}

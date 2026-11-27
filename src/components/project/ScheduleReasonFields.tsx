"use client";
import { useEffect, useRef, useState } from "react";
import { SCHEDULE_REASONS } from "@/lib/schedule-metrics";

/** Appears only when an existing target date is moved, and then requires a
 * reason so the timeline can explain why delivery changed. */
export function ScheduleReasonFields({
  originalTarget,
  fieldName = "targetDate",
}: {
  originalTarget: string | null;
  fieldName?: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    const form = anchor.current?.closest("form");
    const input = form?.elements.namedItem(fieldName);
    if (!(input instanceof HTMLInputElement) || !originalTarget) return;
    const check = () =>
      setMoved(input.value && input.value !== originalTarget ? { from: originalTarget, to: input.value } : input.value ? null : { from: originalTarget, to: "" });
    check();
    input.addEventListener("input", check);
    input.addEventListener("change", check);
    return () => {
      input.removeEventListener("input", check);
      input.removeEventListener("change", check);
    };
  }, [originalTarget, fieldName]);
  const days = moved?.to ? Math.round((Date.parse(moved.to) - Date.parse(moved.from)) / 86_400_000) : null;
  return (
    <div ref={anchor} className={moved ? "rounded-lg border border-brand-orange/50 bg-brand-tint p-3 md:col-span-2" : "hidden"}>
      {moved && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-brand-navy">
            Target date {moved.to ? `moved ${days! > 0 ? `${days} days later` : `${-days!} days earlier`}` : "removed"} — why?
          </p>
          <label className="field">
            Schedule change reason *
            <select name="scheduleReason" required defaultValue="">
              <option value="" disabled>
                Choose a reason
              </option>
              {SCHEDULE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Details (optional)
            <input name="scheduleNote" maxLength={500} placeholder="e.g. Aero sales data arrived two weeks late" />
          </label>
        </div>
      )}
    </div>
  );
}

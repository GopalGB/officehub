/** NRF fiscal years start on the Sunday nearest February 1. Dates are UTC days. */
export const DAY = 86_400_000;
export function dateKey(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}
export function fiscalYearStart(year: number): Date {
  const feb = new Date(Date.UTC(year, 1, 1));
  const offset = feb.getUTCDay();
  return addDays(feb, offset <= 3 ? -offset : 7 - offset);
}
export function weekStart(date: Date): Date {
  const day = new Date(dateKey(date));
  return addDays(day, -day.getUTCDay());
}
export type FiscalConfig = { year: number; startDate: Date; weeks: number };
export function fiscalConfig(
  year: number,
  overrides: FiscalConfig[] = [],
): FiscalConfig {
  return (
    overrides.find((c) => c.year === year) ?? {
      year,
      startDate: fiscalYearStart(year),
      weeks: Math.round(
        (fiscalYearStart(year + 1).getTime() -
          fiscalYearStart(year).getTime()) /
          (7 * DAY),
      ),
    }
  );
}
export function fiscalWeeks(year: number, overrides: FiscalConfig[] = []) {
  const config = fiscalConfig(year, overrides);
  const pattern = [
    4,
    5,
    4,
    4,
    5,
    4,
    4,
    5,
    4,
    4,
    5,
    config.weeks === 53 ? 5 : 4,
  ];
  let index = 0;
  return pattern.flatMap((length, month) =>
    Array.from({ length }, (_, n) => {
      const week = ++index;
      return {
        year,
        week,
        month: month + 1,
        quarter: Math.floor(month / 3) + 1,
        monthWeek: n + 1,
        start: addDays(config.startDate, (week - 1) * 7),
        end: addDays(config.startDate, week * 7 - 1),
      };
    }),
  );
}
export function fiscalPeriod(date: Date, overrides: FiscalConfig[] = []) {
  const day = new Date(dateKey(date)).getTime();
  const year = date.getUTCFullYear();
  for (const fy of [year + 1, year, year - 1]) {
    const found = fiscalWeeks(fy, overrides).find(
      (w) => day >= w.start.getTime() && day <= w.end.getTime(),
    );
    if (found) return found;
  }
  return null;
}
export function fiscalLabel(date: Date, overrides: FiscalConfig[] = []) {
  const period = fiscalPeriod(date, overrides);
  return period
    ? `FY${period.year} · FW${String(period.week).padStart(2, "0")} · P${period.month}`
    : "Outside configured fiscal year";
}

/** Match the Windows server's local calendar day instead of its UTC day. */
export function localToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

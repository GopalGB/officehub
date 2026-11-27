/** Backfill schedule history, and keep linked Excel workbooks fresh without a separate scheduler. Each link
 * has its own interval; this timer only checks which ones are due. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Rebuild schedule history from saved project versions once per start.
    // Idempotent (unique per project/version/field); failures only skip it.
    const { backfillScheduleChanges } = await import("@/lib/schedule");
    setTimeout(() => void backfillScheduleChanges().catch(() => undefined), 5_000);
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.EXCEL_SYNC_DISABLED !== "true") {
    const flag = globalThis as typeof globalThis & { __officehubExcelSync?: boolean };
    if (flag.__officehubExcelSync) return;
    flag.__officehubExcelSync = true;
    const { syncDueExcelLinks } = await import("@/lib/excel-link");
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await syncDueExcelLinks();
      } catch {
        // Errors are stored on each link and shown on its page.
      } finally {
        running = false;
      }
    };
    setTimeout(() => void tick(), 60_000);
    setInterval(() => void tick(), 5 * 60_000);
  }
}

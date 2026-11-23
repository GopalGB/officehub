/** Keep linked Excel workbooks fresh without a separate scheduler. Each link
 * has its own interval; this timer only checks which ones are due. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.EXCEL_SYNC_DISABLED === "true") return;
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

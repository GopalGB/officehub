import Link from "next/link";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { createExcelLink } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { excelLinkAccessWhere } from "@/lib/excel-link";
import { timeAgo } from "@/lib/utils";

export default async function ExcelLinksPage() {
  const session = await auth();
  if (!session?.user) return null;
  const manager = isManagerOrAbove(session.user.role);
  const [links, people] = await Promise.all([
    db.excelLink.findMany({
      where: excelLinkAccessWhere(session.user),
      include: { owner: { select: { name: true } }, _count: { select: { snapshots: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    manager
      ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Resources / Linked Excel</p>
        <h1 className="page-title">Linked Excel workbooks</h1>
        <p className="page-subtitle">
          Link a SharePoint or OneDrive workbook once. OfficeHub reads it on a schedule, explains each sheet,
          and keeps projects, leaves and tables here in step with the Excel file.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {links.map((l) => (
            <Link key={l.id} href={`/dashboard/excel/${l.id}`} className="surface block !p-4 hover:border-brand-orange">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{l.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {Array.isArray(l.sheets) ? l.sheets.length : 0} sheets · linked by {l.owner.name} ·{" "}
                    {l.autoSync ? `syncs every ${l.intervalMin} min` : "manual sync"}
                  </p>
                </div>
                <span className={`pill ${l.lastError ? "!text-brand-orange" : ""}`}>
                  {l.lastError ? "Needs attention" : l.lastSyncedAt ? `Synced ${timeAgo(l.lastSyncedAt)}` : "Not synced yet"}
                </span>
              </div>
            </Link>
          ))}
          {!links.length && (
            <p className="surface text-sm text-muted-foreground">
              {manager ? "No workbooks linked yet. Add one on the right." : "No workbooks have been shared with you yet."}
            </p>
          )}
        </section>
        {manager && (
          <aside className="surface">
            <h2 className="section-title">Link a workbook</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>In Excel Online choose Share → Copy link.</li>
              <li>Set the link to “Anyone with the link can view” (or as your IT allows).</li>
              <li>Paste it below. Nothing is imported until you confirm each sheet.</li>
            </ol>
            <ActionForm action={createExcelLink} label="Link and analyse" className="mt-4 space-y-3">
              <label className="field">
                Name
                <input name="name" required minLength={2} maxLength={120} placeholder="e.g. BI team tracker" />
              </label>
              <label className="field">
                Share link
                <input name="url" type="url" required maxLength={2000} placeholder="https://company.sharepoint.com/:x:/s/…" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="autoSync" defaultChecked /> Keep in sync automatically
              </label>
              <label className="field">
                Check for changes every (minutes)
                <input name="intervalMin" type="number" min={5} max={1440} defaultValue={30} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="shareWithAll" /> Everyone in OfficeHub can view its sheets
              </label>
              <fieldset>
                <legend className="mb-2 text-xs font-medium">Or only these people</legend>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {people.map((p) => (
                    <label key={p.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs">
                      <input type="checkbox" name="viewerIds" value={p.id} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </ActionForm>
          </aside>
        )}
      </div>
    </div>
  );
}

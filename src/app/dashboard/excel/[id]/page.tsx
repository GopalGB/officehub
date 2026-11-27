import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { db } from "@/lib/db";
import { isAdmin, isManagerOrAbove } from "@/lib/rbac";
import {
  saveExcelMappings,
  syncExcelLinkNow,
  deleteExcelLink,
} from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import {
  excelLinkAccessWhere,
  LEAVE_FIELDS,
  mappingsSchema,
  SHEET_PURPOSES,
  type SheetInfo,
} from "@/lib/excel-link";
import { formatDateTime, timeAgo } from "@/lib/utils";

const FIELD_LABELS: Record<keyof typeof LEAVE_FIELDS, string> = {
  person: "Person name",
  email: "Email",
  start: "From date",
  end: "To date",
  type: "Leave type",
  note: "Note",
};
const PAGE = 100;

export default async function ExcelLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sheet?: string; q?: string; page?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const { sheet: sheetParam, q: rawQ, page: rawPage, error } = await searchParams;
  const link = await db.excelLink.findFirst({
    where: { id, AND: [excelLinkAccessWhere(session.user)] },
    include: {
      owner: { select: { name: true } },
      viewers: { select: { id: true, name: true } },
      snapshots: { select: { sheetName: true, updatedAt: true } },
    },
  });
  if (!link) notFound();
  const canManage = isManagerOrAbove(session.user.role) && (link.ownerId === session.user.id || isAdmin(session.user.role));
  const sheets = z.array(z.custom<SheetInfo>((v) => !!v && typeof v === "object")).catch([]).parse(link.sheets);
  const mappings = mappingsSchema.catch({}).parse(link.mappings);
  const result = z
    .array(z.object({ sheet: z.string(), purpose: z.string(), summary: z.string() }))
    .catch([])
    .parse(link.lastResult ?? []);
  const viewable = link.snapshots.map((s) => s.sheetName);
  const activeSheet = sheetParam && viewable.includes(sheetParam) ? sheetParam : null;
  const snapshot = activeSheet
    ? await db.excelSheetSnapshot.findUnique({ where: { linkId_sheetName: { linkId: id, sheetName: activeSheet } } })
    : null;
  const headers = z.array(z.string()).catch([]).parse(snapshot?.headers ?? []);
  const allRows = z.array(z.array(z.string())).catch([]).parse(snapshot?.rows ?? []);
  const q = (rawQ ?? "").trim().toLowerCase().slice(0, 100);
  const rows = q ? allRows.filter((r) => r.some((c) => c.toLowerCase().includes(q))) : allRows;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(rawPage) || 1));
  const people = canManage
    ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">
            <Link href="/dashboard/excel">Linked Excel</Link> / {link.name}
          </p>
          <h1 className="page-title break-words">{link.name}</h1>
          <p className="page-subtitle">
            Linked by {link.owner.name} ·{" "}
            {link.lastSyncedAt ? `last read ${timeAgo(link.lastSyncedAt)} (${formatDateTime(link.lastSyncedAt)})` : "not read yet"} ·{" "}
            {link.autoSync ? `checks every ${link.intervalMin} min` : "manual sync only"}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <ActionForm action={syncExcelLinkNow.bind(null, id)} label="Sync now" successMessage="Workbook synced." className="" />
            <a className="rounded-md border px-3 py-1.5 text-sm" href={link.url} target="_blank" rel="noreferrer">
              Open in Excel
            </a>
          </div>
        )}
      </header>

      {(link.lastError || error) && (
        <p role="alert" className="rounded-lg border border-brand-orange bg-brand-tint p-3 text-sm text-brand-navy">
          {link.lastError ?? "The workbook could not be read."}
        </p>
      )}

      <section className="surface space-y-4">
        <div>
          <h2 className="section-title">What is in this workbook · {sheets.length} sheets</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            OfficeHub suggests what each sheet is for. Confirm it to start syncing. Unconfirmed sheets are only shown as tables.
          </p>
        </div>
        {sheets.length === 0 && <p className="text-sm text-muted-foreground">No sheets read yet. Use Sync now after fixing the link.</p>}
        {canManage && sheets.length > 0 ? (
          <ActionForm action={saveExcelMappings.bind(null, id)} label="Save and use these settings" successMessage="Saved. Use Sync now to apply immediately." className="space-y-4">
            {sheets.map((s, i) => {
              const current = mappings[s.name];
              return (
                <fieldset key={s.name} className="rounded-lg border p-4">
                  <legend className="px-1 text-sm font-semibold">{s.name}</legend>
                  <p className="text-xs text-muted-foreground">
                    {s.rowCount} rows · {s.headers.filter(Boolean).length} columns
                    {s.headers.length > 0 && `: ${s.headers.filter(Boolean).slice(0, 8).join(", ")}${s.headers.length > 8 ? "…" : ""}`}
                  </p>
                  <p className="mt-1 text-xs text-brand-navy">Suggestion: {s.reason}</p>
                  <label className="field mt-3 max-w-sm">
                    Use this sheet as
                    <select name={`purpose-${i}`} defaultValue={current?.purpose ?? s.purpose}>
                      {SHEET_PURPOSES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label} — {p.detail}
                        </option>
                      ))}
                    </select>
                  </label>
                  <details className="mt-3" open={(current?.purpose ?? s.purpose) === "LEAVES"}>
                    <summary className="cursor-pointer text-xs text-brand-link">Leave columns (used when the sheet is Leaves)</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {(Object.keys(LEAVE_FIELDS) as (keyof typeof LEAVE_FIELDS)[]).map((field) => (
                        <label key={field} className="field">
                          {FIELD_LABELS[field]}
                          <select name={`col-${i}-${field}`} defaultValue={current?.columns[field] ?? s.columns[field] ?? ""}>
                            <option value="">Not used</option>
                            {s.headers.filter(Boolean).map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </details>
                </fieldset>
              );
            })}
            <fieldset className="rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">Who can view and how often</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="autoSync" defaultChecked={link.autoSync} /> Keep in sync automatically
              </label>
              <label className="field mt-3 max-w-xs">
                Check every (minutes)
                <input name="intervalMin" type="number" min={5} max={1440} defaultValue={link.intervalMin} />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" name="shareWithAll" defaultChecked={link.shareWithAll} /> Everyone in OfficeHub can view
              </label>
              <p className="mt-3 text-xs font-medium">Or only these people</p>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs">
                    <input type="checkbox" name="viewerIds" value={p.id} defaultChecked={link.viewers.some((v) => v.id === p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        ) : (
          <ul className="space-y-2 text-sm">
            {sheets.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong> · {s.rowCount} rows ·{" "}
                {SHEET_PURPOSES.find((p) => p.value === (mappings[s.name]?.purpose ?? "TABLE"))?.label}
              </li>
            ))}
          </ul>
        )}
        {result.length > 0 && (
          <div className="border-t pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last sync</h3>
            <ul className="mt-2 space-y-1 text-xs">
              {result.map((r) => (
                <li key={r.sheet}>
                  <strong>{r.sheet}</strong>: {r.summary}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Access: {link.shareWithAll ? "everyone in OfficeHub" : link.viewers.length ? link.viewers.map((v) => v.name).join(", ") : "only the owner and administrators"}.
        </p>
      </section>

      {viewable.length > 0 && (
        <section className="surface min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="view-switch flex-wrap" aria-label="Sheets">
              {viewable.map((name) => (
                <Link key={name} href={`?sheet=${encodeURIComponent(name)}`} aria-current={activeSheet === name ? "page" : undefined}>
                  {name}
                </Link>
              ))}
            </nav>
            {activeSheet && (
              <form method="get" className="flex gap-2">
                <input type="hidden" name="sheet" value={activeSheet} />
                <input name="q" defaultValue={rawQ ?? ""} maxLength={100} placeholder="Search rows" className="h-9 rounded-md border px-3 text-sm" />
                <button className="rounded-md border px-3 text-sm" type="submit">
                  Search
                </button>
              </form>
            )}
          </div>
          {!activeSheet && <p className="text-sm text-muted-foreground">Choose a sheet to view its latest rows.</p>}
          {activeSheet && (
            <>
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="whitespace-nowrap px-2 py-2 font-semibold">
                          {h || `Column ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.slice((page - 1) * PAGE, page * PAGE).map((row, r) => (
                      <tr key={r}>
                        {headers.map((_, c) => (
                          <td key={c} className="max-w-[240px] truncate px-2 py-1.5" title={row[c]}>
                            {row[c]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {rows.length} rows{q ? ` matching “${rawQ}”` : ""} · page {page} of {pages}
                {page > 1 && (
                  <Link className="text-link" href={`?sheet=${encodeURIComponent(activeSheet)}&q=${encodeURIComponent(rawQ ?? "")}&page=${page - 1}`}>
                    ← Previous
                  </Link>
                )}
                {page < pages && (
                  <Link className="text-link" href={`?sheet=${encodeURIComponent(activeSheet)}&q=${encodeURIComponent(rawQ ?? "")}&page=${page + 1}`}>
                    Next →
                  </Link>
                )}
              </p>
            </>
          )}
        </section>
      )}

      {canManage && (
        <details className="disclosure">
          <summary>Remove this link</summary>
          <div className="disclosure-body">
            <p className="text-sm text-muted-foreground">
              Removes the link, its sheet copies and leaves imported from it. Projects created from it stay.
            </p>
            <ActionForm action={deleteExcelLink.bind(null, id)} label="Remove link" className="mt-3" />
          </div>
        </details>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Upload, CheckCircle2, ArrowLeft, FileSpreadsheet } from "lucide-react";
import {
  previewProjectImport,
  commitProjectImport,
} from "@/app/dashboard/actions";
import { type ImportPreview, type ImportResult } from "@/lib/project-import";
import { Button } from "@/components/ui/button";

export function ProjectImportForm({
  people,
}: {
  people: { id: string; name: string }[];
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [source, setSource] = useState("");
  const [updates, setUpdates] = useState(false);
  const newCount =
    preview?.rows.filter((row) => row.disposition === "create").length ?? 0;
  const updateCount =
    preview?.rows.filter((row) => row.disposition === "update").length ?? 0;
  if (result)
    return (
      <div className="surface space-y-5" role="status">
        <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
        <h2 className="section-title">Your projects are ready</h2>
        <p className="text-sm">
          {result.created} created · {result.updated} updated · {result.skipped}{" "}
          skipped · {result.changesAdded} timeline changes added.
        </p>
        <p className="text-sm text-muted-foreground">
          Open a project to add delivery dates, teammates, or more changes. The
          workbook’s original columns are in Additional details.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/projects">View projects</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setPreview(null);
              setUpdates(false);
            }}
          >
            Import another workbook
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
      <ol
        className="flex gap-5 text-sm text-muted-foreground"
        aria-label="Import steps"
      >
        <li className={!preview ? "font-semibold text-foreground" : ""}>
          1. Upload
        </li>
        <li className={preview ? "font-semibold text-foreground" : ""}>
          2. Review
        </li>
        <li>3. Save projects</li>
      </ol>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <form
        className={preview ? "hidden" : "surface space-y-5"}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setError("");
          start(async () => {
            try {
              const response = await previewProjectImport(data);
              if ("error" in response)
                setError(response.error ?? "Could not read workbook.");
              else {
                setPreview(response.preview);
                setUpdates(false);
              }
            } catch {
              setError(
                "Could not upload the workbook. Check your connection and try again.",
              );
            }
          });
        }}
      >
        <div className="rounded-xl border border-dashed bg-secondary/40 p-5">
          <FileSpreadsheet className="mb-3 h-7 w-7 text-muted-foreground" />
          <label className="field">
            Excel workbook
            <input
              name="workbook"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  setSource(file.name.replace(/\.xlsx$/i, "").slice(0, 100));
              }}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            .xlsx · up to 3 MB · 200 projects per import. A preview appears
            before anything is saved.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            Owner for new projects
            <select
              name="ownerId"
              required
              disabled={pending || !people.length}
              defaultValue=""
            >
              <option value="" disabled>
                Select a team member
              </option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              Existing project owners and members are kept.
            </span>
          </label>
          <label className="field">
            Import list name
            <input
              name="source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              required
              maxLength={100}
              disabled={pending}
              placeholder="e.g. My project register"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Keep this name when importing an updated version of the same list.
            </span>
          </label>
        </div>
        {!people.length && (
          <p className="text-sm text-muted-foreground">
            Add an active member or manager on the{" "}
            <Link href="/dashboard/team" className="text-link">
              Team page
            </Link>{" "}
            first. Admin is an administrative account and cannot own these
            projects.
          </p>
        )}
        <Button type="submit" disabled={pending || !people.length}>
          <Upload className="mr-2 h-4 w-4" />
          {pending ? "Reading workbook…" : "Preview projects"}
        </Button>
      </form>
      {preview && (
        <div className="space-y-5">
          <div className="surface space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="section-title">Review your import</h2>
                <p className="mt-1 text-sm">
                  Owner for new projects:{" "}
                  <strong>
                    {people.find((person) => person.id === preview.ownerId)
                      ?.name ?? "Selected team member"}
                  </strong>
                </p>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {preview.fileName} · {preview.sheetName}
                </p>
              </div>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setPreview(null);
                  setError("");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Change file or owner
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [preview.rows.length, "Project rows"],
                [newCount, "New projects"],
                [preview.changes, "Recorded changes"],
                [preview.savedHours.toLocaleString(), "Hours saved / year"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl bg-secondary/70 p-3">
                  <p className="text-xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Original columns, including blank cells, are retained as
              Additional details. Discovery becomes Planning; Impact becomes
              Priority. Enhancement rows remain separate projects until you
              choose a source project. Recorded changes without details are
              clearly marked for follow-up.
            </p>
            <p className="text-sm text-muted-foreground">
              Delivery dates are left unset. Existing dates, members,
              descriptions, and timeline changes are kept. New recorded
              iterations are added; edit existing iteration details inside the
              project.
            </p>
          </div>
          <div className="surface overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <caption className="sr-only">
                  Projects and changes that will be imported
                </caption>
                <thead className="border-b bg-secondary/60 text-xs text-muted-foreground">
                  <tr>
                    {[
                      "Row",
                      "Project",
                      "Status / impact",
                      "Changes",
                      "Action",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.map((row) => (
                    <tr key={row.data.key}>
                      <td className="px-4 py-4 text-muted-foreground">
                        {row.data.row}
                      </td>
                      <td className="max-w-sm px-4 py-4">
                        <p className="font-medium">{row.data.title}</p>
                        <details className="mt-2 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            View all columns
                          </summary>
                          <dl className="mt-2 space-y-2">
                            {row.data.additionalDetails.map((field) => (
                              <div key={field.label}>
                                <dt className="font-semibold">{field.label}</dt>
                                <dd className="whitespace-pre-wrap break-words">
                                  {field.value || "—"}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        {(row.data.status ?? "PLANNING")
                          .toLowerCase()
                          .replaceAll("_", " ")}
                        <br />
                        {(row.data.priority ?? "MEDIUM").toLowerCase()}
                      </td>
                      <td className="px-4 py-4">{row.data.changes.length}</td>
                      <td className="max-w-xs px-4 py-4 text-xs">
                        <p className="font-semibold">
                          {row.disposition === "create"
                            ? "Create"
                            : row.disposition === "update" && updates
                              ? "Update existing"
                              : "Skip"}
                        </p>
                        <p className="mt-1 text-muted-foreground">{row.note}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <form
            className="surface space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setError("");
              start(async () => {
                try {
                  const response = await commitProjectImport(data);
                  if ("error" in response)
                    setError(response.error ?? "Could not save import.");
                  else setResult(response.result);
                } catch {
                  setError(
                    "Could not finish the import. Retry Save with this preview; completed imports are never repeated.",
                  );
                }
              });
            }}
          >
            <input type="hidden" name="importId" value={preview.id} />
            {updateCount > 0 && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="updateExisting"
                  checked={updates}
                  onChange={(event) => setUpdates(event.target.checked)}
                  disabled={pending}
                  className="mt-1"
                />
                <span>
                  Update {updateCount} existing matching projects with the
                  spreadsheet’s title, status, impact, type, hours, team, and
                  nonblank additional values. Blank values keep existing
                  details.
                </span>
              </label>
            )}
            <p className="text-sm font-medium">
              {newCount} projects to create · {updates ? updateCount : 0} to
              update ·{" "}
              {preview.rows.length - newCount - (updates ? updateCount : 0)} to
              skip.
            </p>
            <Button
              type="submit"
              disabled={pending || newCount + (updates ? updateCount : 0) === 0}
            >
              {pending ? "Saving projects…" : "Save projects"}
            </Button>
            <p className="text-xs text-muted-foreground">
              This preview expires in one hour. Re-importing the same list and
              references avoids duplicate projects and changes.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

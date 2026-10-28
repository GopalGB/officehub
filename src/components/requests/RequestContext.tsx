import { FileText } from "lucide-react";

export function RequestContext({
  request,
}: {
  request: {
    id: string;
    managerName: string | null;
    department: string | null;
    sopLocation: string | null;
    requiredFilesLocation: string | null;
    sopFileName: string | null;
    sopFileSize: number | null;
  };
}) {
  if (
    !request.managerName &&
    !request.department &&
    !request.sopLocation &&
    !request.requiredFilesLocation &&
    !request.sopFileName
  )
    return null;
  return (
    <section className="mt-5 rounded-xl border bg-secondary/30 p-4">
      <h3 className="text-sm font-semibold">People & supporting information</h3>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        {[
          ["Requester’s manager", request.managerName],
          ["Team / department", request.department],
        ].map(
          ([label, value]) =>
            value && (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-medium">{value}</dd>
              </div>
            ),
        )}
        {[
          ["SOP location", request.sopLocation],
          ["Needed files location / paths", request.requiredFilesLocation],
        ].map(
          ([label, value]) =>
            value && (
              <div key={label} className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-all rounded-lg border bg-card p-3 font-mono text-xs leading-relaxed">
                  {value}
                </dd>
              </div>
            ),
        )}
        {request.sopFileName && (
          <div className="sm:col-span-2">
            <dt className="mb-2 text-xs text-muted-foreground">Uploaded SOP</dt>
            <dd>
              <a
                className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
                href={`/api/requests/${request.id}/sop`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="break-all">{request.sopFileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {Math.max(1, Math.round((request.sopFileSize ?? 0) / 1024))}{" "}
                  KB · Download
                </span>
              </a>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

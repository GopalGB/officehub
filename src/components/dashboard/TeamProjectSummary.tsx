import type { summarizePeopleProjects } from "@/lib/project-summary";
import { formatDate } from "@/lib/utils";

/** Keep the manager's portfolio overview compact with counts rather than titles. */
export function TeamProjectSummary({
  rows,
  asOf,
}: {
  rows: ReturnType<typeof summarizePeopleProjects>;
  asOf: Date;
}) {
  return (
    <section
      className="surface min-w-0 space-y-4"
      aria-labelledby="team-project-summary"
    >
      <div>
        <h2 id="team-project-summary" className="section-title">
          Projects by person
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Completion and remaining work · {formatDate(asOf)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((person) => (
          <article
            key={person.id}
            data-person-summary={person.id}
            className="min-w-0 rounded-xl border bg-secondary/20 p-4"
          >
            <h3 className="break-words text-sm font-semibold">{person.name}</h3>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              {[
                ["Total", person.total],
                ["Completed", person.completed],
                ["Left", person.remaining],
              ].map(([label, count]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd
                    className={`mt-1 text-xl font-semibold tabular-nums ${label === "Left" ? "text-brand-link" : "text-brand-navy"}`}
                  >
                    {count}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label={`${person.name}: completed projects`}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, person.total)}
              aria-valuenow={person.completed}
              aria-valuetext={
                person.total
                  ? `${person.completed} of ${person.total} completed`
                  : "No projects"
              }
            >
              <div
                className="h-full rounded-full bg-brand-orange"
                style={{
                  width: `${person.total ? (person.completed / person.total) * 100 : 0}%`,
                }}
              />
            </div>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-brand-link">
                Status breakdown
                {person.overdue > 0 ? ` · ${person.overdue} overdue` : ""}
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-muted-foreground">
                {[
                  ["Planning", person.planning],
                  ["In progress", person.inProgress],
                  ["Blocked", person.blocked],
                  ["On hold", person.onHold],
                  ["Overdue", person.overdue],
                ].map(([label, count]) => (
                  <div key={label} className="flex gap-2">
                    <dt>{label}</dt>
                    <dd className="font-medium text-foreground">{count}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </article>
        ))}
        {!rows.length && (
          <p className="py-6 text-sm text-muted-foreground">
            No active delivery team members yet.
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Includes ownership, sub-ownership, and collaboration. Each project
        counts once per person. Shared projects can count for more than one
        person; archived projects and Admin accounts are excluded.
      </p>
    </section>
  );
}

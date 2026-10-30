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
          Current project counts, without project names. Overdue is measured as
          of {formatDate(asOf)}.
        </p>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <caption className="sr-only">
            Project completion and remaining work for each team member
          </caption>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              {[
                "Team member",
                "Total",
                "Completed",
                "Left",
                "Planning",
                "In progress",
                "Blocked",
                "On hold",
                "Overdue",
              ].map((label) => (
                <th key={label} scope="col" className="px-3 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((person) => (
              <tr key={person.id} data-person-summary={person.id}>
                <th scope="row" className="min-w-[180px] px-3 py-4 font-medium">
                  <span>{person.name}</span>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
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
                </th>
                {[
                  person.total,
                  person.completed,
                  person.remaining,
                  person.planning,
                  person.inProgress,
                  person.blocked,
                  person.onHold,
                  person.overdue,
                ].map((count, index) => (
                  <td
                    key={index}
                    className={`px-3 py-4 tabular-nums ${index === 2 ? "font-semibold" : "text-muted-foreground"}`}
                  >
                    {count}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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

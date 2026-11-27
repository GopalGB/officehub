import Link from "next/link";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, projectAccessWhere } from "@/lib/rbac";
import { teamAvailability, pickFree } from "@/lib/pool";
import {
  assignHelpRequest,
  closeHelpRequest,
  volunteerForHelp,
} from "@/app/dashboard/actions";
import { HelpRequestForm } from "@/components/help/HelpRequestForm";
import { ActionForm } from "@/components/ui/action-form";
import { formatDate, timeAgo } from "@/lib/utils";

/** Ongoing projects ask for an extra BI teammate; anyone free can pick it up. */
export default async function HelpPoolPage() {
  const session = await auth();
  if (!session?.user) return null;
  const manager = isManagerOrAbove(session.user.role);
  const [requests, people, myProjects, me] = await Promise.all([
    db.helpRequest.findMany({
      where: { status: { in: ["OPEN", "ASSIGNED"] } },
      include: {
        project: { select: { id: true, title: true, ownerId: true, coOwnerId: true, members: { select: { id: true } } } },
        requester: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: [{ status: "desc" }, { createdAt: "asc" }],
      take: 200,
    }),
    teamAvailability(db),
    db.project.findMany({
      where: { AND: [projectAccessWhere(session.user), { status: { in: ["PLANNING", "IN_PROGRESS", "BLOCKED", "ON_HOLD"] } }] },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { notActive: true, role: true } }),
  ]);
  const canVolunteer = !!me && !me.notActive && me.role !== "ADMIN";
  const open = requests.filter((r) => r.status === "OPEN");
  const assigned = requests.filter((r) => r.status === "ASSIGNED");
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="eyebrow">Work / Help pool</p>
        <h1 className="page-title">Help pool</h1>
        <p className="page-subtitle">
          Need another BI teammate on an ongoing project? Ask here. Anyone free can pick it up, or a manager
          can assign someone. The helper joins the project as a collaborator.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="section-title">Open requests · {open.length}</h2>
            {open.map((r) => {
              const team = [r.project.ownerId, r.project.coOwnerId, ...r.project.members.map((m) => m.id)];
              const suggestion = pickFree(people, team.filter((v): v is string => !!v));
              return (
                <article key={r.id} className="surface space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link className="font-semibold hover:underline" href={`/dashboard/projects/${r.project.id}`}>
                        {r.project.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Asked by {r.requester.name} · {timeAgo(r.createdAt)}
                        {r.neededBy ? ` · needed by ${formatDate(r.neededBy)}` : ""}
                      </p>
                    </div>
                    {r.skills && <span className="pill">{r.skills}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{r.details}</p>
                  <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                    {canVolunteer && !team.includes(session.user.id) && (
                      <ActionForm action={volunteerForHelp.bind(null, r.id, r.version)} label="I can help" successMessage="You joined the project." className="" />
                    )}
                    {manager && (
                      <ActionForm action={assignHelpRequest.bind(null, r.id)} label="Assign" successMessage="Helper assigned and added to the project." className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="expectedVersion" value={r.version} />
                        <label className="field">
                          Assign to
                          <select name="assigneeId" defaultValue="AUTO">
                            <option value="AUTO">
                              Whoever is free{suggestion ? ` (now: ${suggestion.name})` : ""}
                            </option>
                            {people
                              .filter((p) => !team.includes(p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.onLeave ? " · on leave" : ` · ${p.openReports} reports, ${p.activeProjects} projects`}
                                </option>
                              ))}
                          </select>
                        </label>
                      </ActionForm>
                    )}
                    <ActionForm action={closeHelpRequest.bind(null, r.id)} label="Close" className="" />
                  </div>
                </article>
              );
            })}
            {!open.length && <p className="surface text-sm text-muted-foreground">No open help requests.</p>}
          </section>

          <details className="disclosure" open={assigned.length > 0 && assigned.length < 5}>
            <summary>Helping now · {assigned.length}</summary>
            <div className="disclosure-body">
              <ul className="space-y-2 text-sm">
                {assigned.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>{r.assignee?.name ?? "Someone"}</strong> is helping on{" "}
                      <Link className="text-link" href={`/dashboard/projects/${r.project.id}`}>
                        {r.project.title}
                      </Link>
                    </span>
                    <ActionForm action={closeHelpRequest.bind(null, r.id)} label="Mark finished" className="" />
                  </li>
                ))}
              </ul>
            </div>
          </details>

          {myProjects.length > 0 && (
            <section className="surface">
              <h2 className="section-title">Ask for help</h2>
              <AskForHelp projects={myProjects} />
            </section>
          )}
        </div>

        <aside className="surface">
          <h2 className="section-title">Who is free</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lowest workload first: open reports plus active projects (counted double). People on leave are last.
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            {people.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className={p.onLeave ? "text-muted-foreground line-through" : ""}>{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.onLeave ? "On leave" : `${p.openReports} rep · ${p.activeProjects} proj`}
                </span>
              </li>
            ))}
            {!people.length && <li className="text-muted-foreground">No team members yet.</li>}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function AskForHelp({ projects }: { projects: { id: string; title: string }[] }) {
  return (
    <div className="mt-3 space-y-4">
      {projects.length > 12 && (
        <p className="text-xs text-muted-foreground">Tip: you can also ask from the project page.</p>
      )}
      <details className="disclosure">
        <summary>Choose a project</summary>
        <div className="disclosure-body space-y-4">
          {projects.slice(0, 50).map((p) => (
            <details key={p.id} className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">{p.title}</summary>
              <HelpRequestForm projectId={p.id} />
            </details>
          ))}
        </div>
      </details>
    </div>
  );
}

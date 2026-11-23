import Link from "next/link";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, projectAccessWhere } from "@/lib/rbac";
import { deleteMeeting } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { MeetingForm } from "@/components/meetings/MeetingForm";
import { formatWallTime, wallNow } from "@/lib/utils";

/** Meetings are entered here or from a project; nothing is sent by email. */
export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { view } = await searchParams;
  const manager = isManagerOrAbove(session.user.role);
  const past = view === "past";
  const now = wallNow();
  const visible = manager
    ? {}
    : {
        OR: [
          { organizerId: session.user.id },
          { attendees: { some: { id: session.user.id } } },
          { project: projectAccessWhere(session.user) },
        ],
      };
  const [meetings, people, projects] = await Promise.all([
    db.meeting.findMany({
      where: { AND: [visible, past ? { startsAt: { lt: now } } : { startsAt: { gte: new Date(now.getTime() - 3600_000) } }] },
      include: {
        attendees: { select: { id: true, name: true } },
        organizer: { select: { name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { startsAt: past ? "desc" : "asc" },
      take: 100,
    }),
    db.user.findMany({ where: { active: true, role: { not: "ADMIN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({
      where: { AND: [projectAccessWhere(session.user), { status: { not: "ARCHIVED" } }] },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Team / Meetings</p>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle">Scheduled and ad-hoc meetings, linked to projects when relevant.</p>
        </div>
        <div className="view-switch">
          <Link href="?view=upcoming" aria-current={!past ? "page" : undefined}>
            Upcoming
          </Link>
          <Link href="?view=past" aria-current={past ? "page" : undefined}>
            Past
          </Link>
        </div>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {meetings.map((m) => (
            <article key={m.id} className="surface !p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-brand-navy">{formatWallTime(m.startsAt)}</p>
                  <h2 className="mt-1 font-semibold">
                    {m.title}
                    {m.kind === "ADHOC" && <span className="pill ml-2">Ad-hoc</span>}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.project ? (
                      <Link className="text-link" href={`/dashboard/projects/${m.project.id}#meetings`}>
                        {m.project.title}
                      </Link>
                    ) : (
                      "General"
                    )}{" "}
                    · organised by {m.organizer.name}
                  </p>
                  <p className="mt-1 text-xs">{m.attendees.map((a) => a.name).join(", ")}</p>
                  {m.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{m.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {m.link && (
                    <a className="text-link text-sm" href={m.link} target="_blank" rel="noreferrer">
                      Join
                    </a>
                  )}
                  {(m.organizerId === session.user.id || manager) && (
                    <ActionForm action={deleteMeeting.bind(null, m.id)} label="Remove" className="" />
                  )}
                </div>
              </div>
            </article>
          ))}
          {!meetings.length && (
            <p className="surface text-sm text-muted-foreground">{past ? "No past meetings." : "No upcoming meetings."}</p>
          )}
        </section>
        <aside className="surface">
          <h2 className="section-title">Add a meeting</h2>
          <div className="mt-3">
            <MeetingForm people={people} projects={projects} attendeeIds={[session.user.id]} />
          </div>
        </aside>
      </div>
    </div>
  );
}

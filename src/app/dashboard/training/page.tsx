import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { createTraining, deleteTraining } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { formatWallTime, wallNow } from "@/lib/utils";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user) return null;
  const manager = isManagerOrAbove(session.user.role);
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { team: true } });
  const trainings = await db.training.findMany({
    where: manager ? {} : { OR: [{ audience: null }, { audience: "" }, ...(me?.team ? [{ audience: me.team }] : [])] },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ sessionAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  });
  const now = wallNow();
  const upcoming = trainings.filter((t) => t.sessionAt && t.sessionAt >= now).reverse();
  const library = trainings.filter((t) => !t.sessionAt || t.sessionAt < now);
  const Card = ({ t }: { t: (typeof trainings)[number] }) => (
    <article className="surface !p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {t.sessionAt && <p className="text-xs font-semibold text-brand-navy">{formatWallTime(t.sessionAt)}</p>}
          <h3 className="mt-1 font-semibold">{t.title}</h3>
          <p className="text-xs text-muted-foreground">
            {t.audience ? `For ${t.audience}` : "For everyone"} · added by {t.createdBy.name}
          </p>
          {t.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {t.url && (
            <a className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white" href={t.url} target="_blank" rel="noreferrer">
              {t.sessionAt && t.sessionAt >= now ? "Join session" : "Open"}
            </a>
          )}
          {manager && <ActionForm action={deleteTraining.bind(null, t.id)} label="Remove" className="" />}
        </div>
      </div>
    </article>
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Resources / Training</p>
        <h1 className="page-title">Training</h1>
        <p className="page-subtitle">Upcoming sessions and a library of recordings, decks and how-to links.</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="section-title">Upcoming sessions · {upcoming.length}</h2>
            {upcoming.map((t) => (
              <Card key={t.id} t={t} />
            ))}
            {!upcoming.length && <p className="text-sm text-muted-foreground">No sessions scheduled.</p>}
          </section>
          <section className="space-y-3">
            <h2 className="section-title">Library · {library.length}</h2>
            {library.map((t) => (
              <Card key={t.id} t={t} />
            ))}
            {!library.length && <p className="text-sm text-muted-foreground">No training links yet.</p>}
          </section>
        </div>
        {manager && (
          <aside className="surface">
            <h2 className="section-title">Add training</h2>
            <ActionForm action={createTraining} label="Add training" successMessage="Training added." className="mt-3 space-y-3">
              <label className="field">
                Title
                <input name="title" required minLength={2} maxLength={160} placeholder="e.g. Power BI basics" />
              </label>
              <label className="field">
                Link (Teams, recording, deck)
                <input name="url" type="url" maxLength={2000} placeholder="https://…" />
              </label>
              <label className="field">
                Session time (leave empty for a library link)
                <input name="sessionAt" type="datetime-local" />
              </label>
              <label className="field">
                Audience (team name, empty for everyone)
                <input name="audience" maxLength={100} />
              </label>
              <label className="field">
                Description
                <textarea name="description" rows={3} maxLength={2000} />
              </label>
            </ActionForm>
          </aside>
        )}
      </div>
    </div>
  );
}

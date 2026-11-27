import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";
import { NewPagePicker } from "@/components/pages/NewPagePicker";
import { blockText, searchSnippet } from "@/lib/page-text";
import { similarityIndex } from "@/lib/similarity";
import { createContact, deleteContact } from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";

export default async function PagesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const manager = isManagerOrAbove(session.user.role);
  const [pages, contacts, people] = await Promise.all([
    db.page.findMany({
      where: { archived: false },
      orderBy: { updatedAt: "desc" },
      take: q ? 1000 : 12,
      include: { author: { select: { name: true } } },
    }),
    db.contact.findMany({
      include: { person: { select: { name: true, email: true, team: true } } },
      orderBy: { topic: "asc" },
    }),
    manager
      ? db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
  ]);
  const needle = q.toLowerCase();
  // Exact word matches rank first; similar wording (other forms of a word,
  // different order) follows, ranked by word similarity.
  const docs = q
    ? pages.map((p) => ({ page: p, text: blockText(p.content).join(" ") }))
    : [];
  const similar = q
    ? similarityIndex(docs.map((d) => ({ text: `${d.page.title} ${d.page.title} ${d.text}`, item: d })))
        .rank(q, 50, 0.12)
    : [];
  const exact = docs.filter(
    (d) => d.page.title.toLowerCase().includes(needle) || d.text.toLowerCase().includes(needle),
  );
  const results = q
    ? [...exact, ...similar.map((m) => m.item).filter((d) => !exact.includes(d))]
        .slice(0, 50)
        .map((d) => ({ page: d.page, score: 0, snippet: d.text ? searchSnippet(d.text, q) : "" }))
    : pages.map((page) => ({ page, score: 0, snippet: "" }));
  const shownContacts = q
    ? contacts.filter((c) =>
        [c.topic, c.name, c.email, c.notes, c.person?.name, c.person?.email, c.person?.team]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle)),
      )
    : contacts;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Wiki</h1>
          <p className="page-subtitle">Docs, runbooks, SOPs and who to ask about what.</p>
        </div>
        <NewPagePicker />
      </header>

      <form method="get" className="flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Search the wiki and contacts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="Search pages and contacts, e.g. “Aero refresh” or “server access”"
            className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
          />
        </label>
        <button type="submit" className="rounded-lg bg-brand-navy px-4 text-sm font-medium text-white">
          Search
        </button>
        {q && (
          <Link href="/dashboard/pages" className="self-center text-sm text-brand-link">
            Clear
          </Link>
        )}
      </form>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {q ? `Pages matching “${q}” · ${results.length}` : "Recently updated"}
          </h2>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {results.map(({ page: p, snippet }) => (
              <li key={p.id}>
                <Link href={`/dashboard/pages/${p.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="text-lg">{p.emoji ? p.emoji : <FileText className="mt-0.5 h-4 w-4 text-slate-400" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.title || "Untitled"}</p>
                    {snippet && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{snippet}</p>}
                    <p className="text-xs text-slate-500">
                      Updated {timeAgo(p.updatedAt)} · by {p.author.name}
                    </p>
                  </div>
                  <Avatar name={p.author.name} size="sm" />
                </Link>
              </li>
            ))}
            {!results.length && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                {q ? "No pages match. Try another word." : "No pages yet. Create a runbook, onboarding doc or meeting note."}
              </li>
            )}
          </ul>
        </section>

        <aside className="surface space-y-4" id="contacts">
          <div>
            <h2 className="section-title">Whom to contact</h2>
            <p className="mt-1 text-xs text-muted-foreground">Who to ask for each system, report or process.</p>
          </div>
          <ul className="space-y-3">
            {shownContacts.map((c) => {
              const name = c.person?.name ?? c.name ?? "";
              const email = c.person?.email ?? c.email;
              return (
                <li key={c.id} className="rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">{c.topic}</p>
                  <p className="mt-1 text-sm font-medium">{name}</p>
                  {email && (
                    <a className="text-link text-xs" href={`mailto:${email}`}>
                      {email}
                    </a>
                  )}
                  {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
                  {manager && (
                    <div className="mt-2">
                      <ActionForm action={deleteContact.bind(null, c.id)} label="Remove" className="" />
                    </div>
                  )}
                </li>
              );
            })}
            {!shownContacts.length && (
              <li className="text-sm text-muted-foreground">{q ? "No contacts match." : "No contacts yet."}</li>
            )}
          </ul>
          {manager && (
            <details className="disclosure">
              <summary>Add a contact</summary>
              <div className="disclosure-body">
                <ActionForm action={createContact} label="Add contact" successMessage="Contact added." className="space-y-3">
                  <label className="field">
                    Topic
                    <input name="topic" required minLength={2} maxLength={120} placeholder="e.g. JCP report access" />
                  </label>
                  <label className="field">
                    Teammate
                    <select name="personId" defaultValue="">
                      <option value="">Someone outside OfficeHub</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field">
                      Name (if outside)
                      <input name="name" maxLength={100} />
                    </label>
                    <label className="field">
                      Email (if outside)
                      <input name="email" type="email" maxLength={254} />
                    </label>
                  </div>
                  <label className="field">
                    Notes
                    <input name="notes" maxLength={500} placeholder="e.g. Raise a ticket first" />
                  </label>
                </ActionForm>
              </div>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}

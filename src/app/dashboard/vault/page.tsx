import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import {
  saveCredential,
  deleteCredential,
  revealCredential,
  createReminder,
} from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { RevealSecret } from "@/components/common/RevealSecret";
import { vaultReady } from "@/lib/vault";
import { addDays, dateKey, localToday } from "@/lib/fiscal";
import { formatDate } from "@/lib/utils";
import type { Credential } from "@prisma/client";

const KINDS = [
  { value: "SERVER", label: "Server" },
  { value: "AERO", label: "Aero report" },
  { value: "JCP", label: "JCP report" },
  { value: "OTHER", label: "Other" },
];

/** Logins for servers and report portals, private to you or shared with your team. */
export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { kind } = await searchParams;
  const me = await db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { team: true } });
  const credentials = await db.credential.findMany({
    where: {
      AND: [
        { OR: [{ ownerId: session.user.id }, ...(me.team ? [{ scope: "TEAM", team: me.team }] : [])] },
        kind && KINDS.some((k) => k.value === kind) ? { kind } : {},
      ],
    },
    include: { owner: { select: { name: true } } },
    orderBy: [{ kind: "asc" }, { label: "asc" }],
  });
  const ready = vaultReady();
  const today = localToday();
  const soon = addDays(today, 14);
  const label = (c: Credential) => KINDS.find((k) => k.value === c.kind)?.label ?? c.kind;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="eyebrow">Resources / Servers & passwords</p>
        <h1 className="page-title">Servers & passwords</h1>
        <p className="page-subtitle">
          Keep server, Aero and JCP logins in one place. <strong>Only me</strong> entries are visible to you alone;{" "}
          <strong>My team</strong> entries are visible to everyone in {me.team ? `the ${me.team} team` : "your team"}.
          Passwords are encrypted and every view is logged.
        </p>
      </header>
      {!ready && (
        <p role="alert" className="rounded-lg border border-brand-orange bg-brand-tint p-3 text-sm text-brand-navy">
          The vault key is not configured, so passwords cannot be saved yet. An administrator must add{" "}
          <code>VAULT_KEY</code> to the server .env (generate one with <code>openssl rand -base64 32</code>) and restart.
          Server names, usernames and expiry dates can still be saved.
        </p>
      )}
      <nav className="view-switch" aria-label="Filter by type">
        <a href="/dashboard/vault" aria-current={!kind ? "page" : undefined}>
          All
        </a>
        {KINDS.map((k) => (
          <a key={k.value} href={`?kind=${k.value}`} aria-current={kind === k.value ? "page" : undefined}>
            {k.label}
          </a>
        ))}
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {credentials.map((c) => {
            const expired = c.expiresAt && c.expiresAt < today;
            const expiring = c.expiresAt && !expired && c.expiresAt <= soon;
            return (
              <article key={c.id} className="surface !p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label(c)} · {c.scope === "TEAM" ? `Team ${c.team}` : "Only me"} · added by {c.owner.name}
                    </p>
                    <h2 className="mt-1 font-semibold">{c.label}</h2>
                    {c.host && <p className="text-xs">Host: <code>{c.host}</code></p>}
                    {c.url && (
                      <a className="text-link text-xs" href={c.url} target="_blank" rel="noreferrer">
                        {c.url}
                      </a>
                    )}
                  </div>
                  {c.expiresAt && (
                    <span className={`pill ${expired || expiring ? "!bg-brand-tint font-semibold !text-brand-orange" : ""}`}>
                      {expired ? "Expired" : "Expires"} {formatDate(c.expiresAt)}
                    </span>
                  )}
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Username</dt>
                    <dd><code className="text-xs">{c.username || "—"}</code></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Password</dt>
                    <dd>{c.secretCipher ? <RevealSecret reveal={revealCredential.bind(null, c.id)} /> : <span className="text-xs text-muted-foreground">Not saved</span>}</dd>
                  </div>
                </dl>
                {c.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{c.notes}</p>}
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-brand-link">Edit, remind or remove</summary>
                  <div className="mt-3 space-y-4">
                    {(c.ownerId === session.user.id || c.scope === "TEAM") && (
                      <CredentialForm credential={c} canShareWithTeam={!!me.team} ready={ready} />
                    )}
                    <ActionForm action={createReminder} label="Remind me" successMessage="Reminder added." className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="credentialId" value={c.id} />
                      <input type="hidden" name="title" value={`Change password: ${c.label}`.slice(0, 200)} />
                      <label className="field">
                        Remind me on
                        <input
                          name="dueAt"
                          type="date"
                          required
                          defaultValue={dateKey(c.expiresAt ? addDays(c.expiresAt, -7) : addDays(today, 30))}
                        />
                      </label>
                      <input type="hidden" name="repeat" value="NONE" />
                    </ActionForm>
                    {c.ownerId === session.user.id && (
                      <ActionForm action={deleteCredential.bind(null, c.id)} label="Remove this login" className="" />
                    )}
                  </div>
                </details>
              </article>
            );
          })}
          {!credentials.length && <p className="surface text-sm text-muted-foreground">No saved logins yet.</p>}
        </section>
        <aside className="surface">
          <h2 className="section-title">Add a login</h2>
          <div className="mt-3">
            <CredentialForm canShareWithTeam={!!me.team} ready={ready} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CredentialForm({
  credential,
  canShareWithTeam,
  ready,
}: {
  credential?: Credential;
  canShareWithTeam: boolean;
  ready: boolean;
}) {
  return (
    <ActionForm
      action={saveCredential.bind(null, credential?.id ?? null)}
      label={credential ? "Save login" : "Add login"}
      successMessage="Login saved."
      className="space-y-3"
    >
      {credential && <input type="hidden" name="expectedVersion" value={credential.version} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Type
          <select name="kind" defaultValue={credential?.kind ?? "SERVER"}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Visible to
          <select name="scope" defaultValue={credential?.scope ?? "USER"}>
            <option value="USER">Only me</option>
            {canShareWithTeam && <option value="TEAM">My team</option>}
          </select>
        </label>
      </div>
      <label className="field">
        Name
        <input name="label" required minLength={2} maxLength={120} defaultValue={credential?.label} placeholder="e.g. Production SQL server" />
      </label>
      <label className="field">
        Server / host (optional)
        <input name="host" maxLength={255} defaultValue={credential?.host ?? ""} placeholder="e.g. 10.0.0.12 or sql-prod-01" />
      </label>
      <label className="field">
        Portal link (optional)
        <input name="url" type="url" maxLength={2000} defaultValue={credential?.url ?? ""} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Username
          <input name="username" maxLength={200} defaultValue={credential?.username ?? ""} autoComplete="off" />
        </label>
        <label className="field">
          {credential ? "New password (blank keeps current)" : "Password"}
          <input name="secret" type="password" maxLength={500} autoComplete="new-password" disabled={!ready} />
        </label>
      </div>
      <label className="field">
        Password expires on (optional)
        <input name="expiresAt" type="date" defaultValue={credential?.expiresAt ? dateKey(credential.expiresAt) : ""} />
      </label>
      <label className="field">
        Notes
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={credential?.notes ?? ""} />
      </label>
    </ActionForm>
  );
}

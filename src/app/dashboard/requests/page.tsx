import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isManagerOrAbove, isAdmin } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  createRequestLink,
  revokeRequestLink,
  decideProjectRequest,
} from "@/app/dashboard/actions";
import { ActionForm } from "@/components/ui/action-form";
import { CopyLink } from "@/components/requests/CopyLink";
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isManagerOrAbove(session.user.role))
    redirect("/dashboard");
  const params = await searchParams,
    status = ["PENDING", "ASSIGNED", "REJECTED"].includes(params.status ?? "")
      ? params.status!
      : "PENDING";
  const page = Math.max(
    1,
    Math.min(10000, Math.trunc(Number(params.page)) || 1),
  );
  const [requests, count, links, people, projects, pending] = await Promise.all(
    [
      db.projectRequest.findMany({
        where: { status },
        include: {
          link: {
            select: { label: true, manager: { select: { name: true } } },
          },
          project: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        skip: (page - 1) * 30,
      }),
      db.projectRequest.count({ where: { status } }),
      db.requestLink.findMany({
        where: isAdmin(session.user.role) ? {} : { managerId: session.user.id },
        include: {
          manager: { select: { name: true } },
          _count: { select: { requests: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.project.findMany({
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
      db.projectRequest.count({ where: { status: "PENDING" } }),
    ],
  );
  const origin = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="eyebrow">Management / Intake</p>
        <h1 className="page-title">
          Request pool <span className="ml-2 pill">{pending} pending</span>
        </h1>
        <p className="page-subtitle">
          Collect project requests through a form, review effort and savings,
          then assign ownership.
        </p>
      </header>
      <details className="surface">
        <summary className="cursor-pointer text-sm font-semibold">
          Create and manage request links
        </summary>
        <div className="mt-5 grid items-start gap-6 lg:grid-cols-2">
          <ActionForm
            action={createRequestLink}
            label="Create request link"
            successMessage="Link created. Copy it from the list to share it."
          >
            <label className="field">
              Form title
              <input
                name="label"
                minLength={2}
                maxLength={120}
                required
                placeholder="e.g. BI project request"
              />
            </label>
            <label className="field">
              Recipient email (optional)
              <input
                name="recipientEmail"
                type="email"
                placeholder="Leave empty for a reusable team form"
              />
            </label>
            <label className="field">
              Expires in
              <select name="days" defaultValue="14">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Anyone holding a valid link can submit a request without an
              account. They cannot view the workspace or the request pool. Share
              the link with its intended recipients.
            </p>
          </ActionForm>
          <div className="space-y-4">
            {links.map((link) => {
              const active = !link.revokedAt && link.expiresAt > new Date();
              return (
                <div className="rounded-lg border p-4" key={link.id}>
                  <p className="text-sm font-semibold">{link.label}</p>
                  <p className="mb-3 mt-1 text-[11px] text-muted-foreground">
                    {link.recipientEmail ?? "Reusable form"} ·{" "}
                    {link._count.requests} submissions ·{" "}
                    {active
                      ? `Expires ${formatDate(link.expiresAt)}`
                      : link.revokedAt
                        ? "Revoked"
                        : "Expired"}
                  </p>
                  {active && (
                    <>
                      <CopyLink url={`${origin}/request/${link.token}`} />
                      <ActionForm
                        className="mt-3"
                        action={revokeRequestLink.bind(null, link.id)}
                        label="Revoke link"
                      />
                    </>
                  )}
                </div>
              );
            })}
            {!links.length && (
              <p className="text-sm text-muted-foreground">
                Create a link, then copy it here and send it to the requester.
              </p>
            )}
          </div>
        </div>
      </details>
      <nav className="flex gap-2 text-sm">
        {["PENDING", "ASSIGNED", "REJECTED"].map((s) => (
          <Link
            className={`rounded-lg border px-4 py-2 ${s === status ? "border-brand-orange bg-brand-tint font-semibold" : "bg-card"}`}
            key={s}
            href={`?status=${s}`}
          >
            {s.toLowerCase().replace(/^./, (c) => c.toUpperCase())}
          </Link>
        ))}
      </nav>
      <div className="space-y-4">
        {requests.map((request) => (
          <article className="surface" key={request.id}>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">
                  {request.projectType.replaceAll("_", " ")} /{" "}
                  {request.priority} priority
                </p>
                <h2 className="text-lg font-semibold">{request.title}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {request.submitterName} · {request.submitterEmail} ·{" "}
                  {formatDateTime(request.createdAt)}
                </p>
              </div>
              <span className="pill">{request.status}</span>
            </header>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
              {request.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                Estimated: <strong>{request.estimatedHours}h</strong>
              </span>
              <span>
                Time saved: <strong>{request.savedHours ?? "—"}h / week</strong>
              </span>
              <span>Requested date: {formatDate(request.requestedDate)}</span>
              {request.existingProject && (
                <span>Existing project: {request.existingProject}</span>
              )}
              <span>Submitted to {request.link.manager.name}</span>
            </div>
            {request.project ? (
              <p className="mt-5 text-sm">
                <Link
                  className="text-link"
                  href={`/dashboard/projects/${request.project.id}`}
                >
                  Open assigned project → {request.project.title}
                </Link>
              </p>
            ) : (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm font-medium text-brand-link">
                  Review and assign
                </summary>
                <div className="mt-4">
                  <ActionForm
                    action={decideProjectRequest}
                    label="Save review"
                    successMessage="Request updated."
                  >
                    <input type="hidden" name="requestId" value={request.id} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={request.version}
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="field">
                        Decision
                        <select name="decision" defaultValue="ASSIGN">
                          <option value="ASSIGN">Assign as a project</option>
                          <option value="PENDING">Keep in pool</option>
                          <option value="REJECT">Reject / decline</option>
                        </select>
                      </label>
                      <label className="field">
                        Assign owner
                        <select name="ownerId" defaultValue="">
                          <option value="">Choose a user</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Enhances / follows project
                        <select name="sourceProjectId" defaultValue="">
                          <option value="">Standalone project</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      Manager notes
                      <textarea
                        name="notes"
                        maxLength={2000}
                        rows={3}
                        defaultValue={request.managerNotes ?? ""}
                      />
                    </label>
                  </ActionForm>
                </div>
              </details>
            )}
            {request.managerNotes && (
              <p className="mt-4 text-xs text-muted-foreground">
                Manager notes: {request.managerNotes}
              </p>
            )}
          </article>
        ))}
        {!requests.length && (
          <div className="surface py-12 text-center">
            <p className="font-semibold">The pool is clear</p>
            <p className="page-subtitle mx-auto">
              No {status.toLowerCase()} requests. Create a request link above to
              collect new work.
            </p>
          </div>
        )}
      </div>
      <div className="flex justify-between text-sm">
        {page > 1 ? (
          <Link
            className="text-link"
            href={`?status=${status}&page=${page - 1}`}
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">{count} requests</span>
        {page * 30 < count && (
          <Link
            className="text-link"
            href={`?status=${status}&page=${page + 1}`}
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

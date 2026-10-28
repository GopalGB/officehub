import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { BrandIdentity } from "@/components/layout/BrandIdentity";
import { RequestForm } from "@/components/requests/RequestForm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Automation request | Catalyst Brands",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function PublicRequest({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const link = await db.requestLink.findUnique({
    where: { token },
    include: { manager: { select: { name: true, active: true, role: true } } },
  });
  if (
    !link ||
    link.revokedAt ||
    link.expiresAt <= new Date() ||
    !link.manager.active ||
    !isManagerOrAbove(link.manager.role)
  )
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <BrandIdentity />
        <div className="surface mt-8">
          <h1 className="page-title">This form is unavailable</h1>
          <p className="page-subtitle">
            The link has expired or was revoked. Ask the manager for a new
            request link.
          </p>
        </div>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <BrandIdentity />
      <header className="max-w-2xl">
        <p className="eyebrow">Catalyst Brands / Automation intake</p>
        <h1 className="page-title">{link.label}</h1>
        <p className="page-subtitle">
          Bring the next improvement into focus. Share your requirements,
          process instructions, and expected impact in one place.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <RequestForm token={token} email={link.recipientEmail} />
        <aside className="surface space-y-5 lg:sticky lg:top-6">
          <div>
            <p className="eyebrow">What happens next</p>
            <ol className="mt-4 space-y-4 text-sm">
              <li>
                <strong className="block">1. Share the request</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Include the outcome, SOP, and source file locations.
                </span>
              </li>
              <li>
                <strong className="block">2. Manager review</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Scope, effort, and priority are reviewed in the request pool.
                </span>
              </li>
              <li>
                <strong className="block">3. Assign & track</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  An owner is assigned and the work becomes a tracked project.
                </span>
              </li>
            </ol>
          </div>
          <div className="border-t pt-4 text-xs text-muted-foreground">
            <p>Reviewed by</p>
            <p className="mt-1 font-semibold text-foreground">
              {link.manager.name}
            </p>
            <p className="mt-3 leading-relaxed">
              Fields marked * are required. You can submit without a workspace
              account.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

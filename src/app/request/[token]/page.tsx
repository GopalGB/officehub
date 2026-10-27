import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isManagerOrAbove } from "@/lib/rbac";
import { BrandIdentity } from "@/components/layout/BrandIdentity";
import { RequestForm } from "@/components/requests/RequestForm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Project request | Catalyst Brands",
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
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <BrandIdentity />
      <header>
        <p className="eyebrow">Catalyst Brands / Project intake</p>
        <h1 className="page-title">{link.label}</h1>
        <p className="page-subtitle">
          Tell {link.manager.name} what you need. Include the outcome, estimated
          effort, and any time savings.
        </p>
      </header>
      <RequestForm token={token} email={link.recipientEmail} />
    </main>
  );
}

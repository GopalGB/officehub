import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { acceptInvitation } from "@/app/dashboard/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function InviteAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const invite = await db.invitation.findUnique({
    where: { token },
    include: { invitedBy: { select: { name: true } } },
  });

  if (!invite) {
    return (
      <Wrap>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>This link may have been revoked or never existed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm font-medium underline-offset-2 hover:underline">
              ← Go to sign in
            </Link>
          </CardContent>
        </Card>
      </Wrap>
    );
  }

  if (invite.acceptedAt) {
    return (
      <Wrap>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Already accepted</CardTitle>
            <CardDescription>This invitation has been used. Sign in below.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </Wrap>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <Wrap>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invitation expired</CardTitle>
            <CardDescription>Ask your admin for a fresh invite link.</CardDescription>
          </CardHeader>
        </Card>
      </Wrap>
    );
  }

  async function acceptAction(formData: FormData) {
    "use server";
    const result = await acceptInvitation(token, formData);
    if (result && "error" in result && result.error) {
      redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
    }
  }

  return (
    <Wrap>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re invited to OfficeHub</CardTitle>
          <CardDescription>
            {invite.invitedBy.name} invited <strong>{invite.email}</strong> as{" "}
            <Badge variant="muted" className="ml-1 align-middle">
              {invite.role}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={acceptAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={invite.email} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Pick a password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
              <p className="text-xs text-slate-500">Min 8 chars with uppercase, lowercase, and a number.</p>
            </div>
            {error && (
              <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              Create my account
            </Button>
          </form>
        </CardContent>
      </Card>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">{children}</div>;
}

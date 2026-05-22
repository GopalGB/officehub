import { redirect } from "next/navigation";
import Link from "next/link";
import bcrypt from "bcryptjs";
import { auth, signIn } from "../../../auth";
import { db } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const policy = process.env.SIGNUP_POLICY ?? "closed";
  if (policy !== "open") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Signup is closed</CardTitle>
            <CardDescription>Ask your admin to create an account for you.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm font-medium underline-offset-2 hover:underline">
              ← Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { error } = await searchParams;

  async function signupAction(formData: FormData) {
    "use server";
    const parsed = signupSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      redirect(`/signup?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }
    const data = parsed.data;
    const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) redirect(`/signup?error=${encodeURIComponent("Email already registered")}`);

    const passwordHash = await bcrypt.hash(data.password, 12);
    await db.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        role: "MEMBER",
      },
    });
    await signIn("credentials", { email: data.email, password: data.password, redirectTo: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your OfficeHub account</CardTitle>
          <CardDescription>Open signup is enabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signupAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
              <p className="text-xs text-slate-500">Min 8 chars with uppercase, lowercase, number.</p>
            </div>
            {error && (
              <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-slate-900 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

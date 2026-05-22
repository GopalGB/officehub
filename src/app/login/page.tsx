import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "../../../auth";
import { AuthError } from "next-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const { error } = await searchParams;

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect("/login?error=CredentialsSignin");
      }
      throw e;
    }
  }

  const signupPolicy = process.env.SIGNUP_POLICY ?? "closed";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to OfficeHub</CardTitle>
          <CardDescription>Track your projects, timelines, and team status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {error === "CredentialsSignin" && (
              <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Wrong email or password.
              </p>
            )}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          {signupPolicy === "open" && (
            <p className="mt-4 text-center text-sm text-slate-500">
              Need an account?{" "}
              <Link href="/signup" className="font-medium text-slate-900 underline-offset-2 hover:underline">
                Create one
              </Link>
            </p>
          )}
          {signupPolicy !== "open" && (
            <p className="mt-4 text-center text-xs text-slate-400">
              Accounts are created by your office admin.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

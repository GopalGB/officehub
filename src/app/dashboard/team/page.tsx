import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createUser, updateUser } from "@/app/dashboard/actions";
import { formatDate } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/dashboard");

  const users = await db.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  async function createAction(fd: FormData) {
    "use server";
    await createUser(fd);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-slate-500">Add teammates, change roles, deactivate accounts.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add user</CardTitle>
          <CardDescription>
            Share the temporary password with them — they can change it from Settings after sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px_auto]">
            <div className="space-y-1">
              <Label htmlFor="t-name">Name</Label>
              <Input id="t-name" name="name" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-email">Email</Label>
              <Input id="t-email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-password">Temp password</Label>
              <Input id="t-password" name="password" required minLength={8} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-role">Role</Label>
              <Select id="t-role" name="role" defaultValue="MEMBER">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="self-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const isSelf = u.id === session.user.id;
              async function update(fd: FormData) {
                "use server";
                await updateUser(u.id, fd);
              }
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <form action={update} className="inline-flex">
                      <Select
                        name="role"
                        defaultValue={u.role}
                        disabled={isSelf}
                        className="h-8 w-[120px] text-xs"
                        onChange={(e) => {
                          const f = new FormData();
                          f.set("role", e.currentTarget.value);
                          void update(f);
                        }}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Disabled</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <form action={update} className="inline">
                        <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                        <Button type="submit" variant="ghost" size="sm">
                          {u.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

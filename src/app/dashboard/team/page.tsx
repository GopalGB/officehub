import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { AddTeammateTabs } from "@/components/team/AddTeammateTabs";
import { PendingInvites } from "@/components/team/PendingInvites";
import { updateUser } from "@/app/dashboard/actions";
import { inviteUrl } from "@/lib/invitations";
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

  const [users, invites] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    db.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-slate-500">
          Invite teammates with a one-click link — they pick their own password. Change roles or
          deactivate anyone.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add teammate</CardTitle>
          <CardDescription>
            Two ways. Pick whichever fits the moment — invite link if they&apos;ll set their own
            password, or set the password yourself if you&apos;re onboarding in person and want
            them in immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddTeammateTabs />
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending invites ({invites.length})
          </h2>
          <PendingInvites
            invites={invites.map((i) => ({
              id: i.id,
              email: i.email,
              role: i.role,
              url: inviteUrl(i.token),
              expiresAt: i.expiresAt,
              createdAt: i.createdAt,
              invitedByName: i.invitedBy.name,
            }))}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active accounts ({users.filter((u) => u.active).length}) ·{" "}
          {users.filter((u) => !u.active).length} disabled
        </h2>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} />
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
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
                      {u.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="muted">Disabled</Badge>
                      )}
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
      </section>
    </div>
  );
}

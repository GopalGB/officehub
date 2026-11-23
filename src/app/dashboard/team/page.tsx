import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { AddTeammateTabs } from "@/components/team/AddTeammateTabs";
import { PendingInvites } from "@/components/team/PendingInvites";
import { InlineRoleSelect } from "@/components/team/InlineRoleSelect";
import { updateUser, updateUserTeam } from "@/app/dashboard/actions";
import { inviteUrl } from "@/lib/invitations";
import { shareOrigin } from "@/lib/origin";
import { formatDate } from "@/lib/utils";
import { ActionForm } from "@/components/ui/action-form";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/dashboard");

  const origin = await shareOrigin();
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
          Invite teammates, set their team and role. Mark someone <strong>Not active</strong> when
          they are away or off BI work: they keep their history and can still sign in, but are not
          offered for new work. Disable login only when someone leaves.
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
              url: inviteUrl(i.token, origin),
              expiresAt: i.expiresAt,
              createdAt: i.createdAt,
              invitedByName: i.invitedBy.name,
            }))}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active ({users.filter((u) => u.active && !u.notActive).length}) · Not active (
          {users.filter((u) => u.active && u.notActive).length}) · Login disabled (
          {users.filter((u) => !u.active).length})
        </h2>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.id === session.user.id;
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
                      <ActionForm
                        action={updateUserTeam.bind(null, u.id)}
                        label="Save"
                        successMessage="Team saved."
                        className="flex items-start gap-1"
                      >
                        <input
                          name="team"
                          defaultValue={u.team ?? ""}
                          maxLength={100}
                          placeholder="e.g. BI"
                          aria-label={`Team for ${u.name}`}
                          className="h-8 w-28 rounded-md border px-2 text-xs"
                        />
                      </ActionForm>
                    </td>
                    <td className="px-4 py-3">
                      <InlineRoleSelect userId={u.id} defaultValue={u.role} disabled={isSelf} />
                    </td>
                    <td className="px-4 py-3">
                      {!u.active ? (
                        <Badge variant="muted">Login disabled</Badge>
                      ) : u.notActive ? (
                        <Badge variant="warning">Not active</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.active && (
                        <ActionForm
                          action={updateUserTeam.bind(null, u.id)}
                          label={u.notActive ? "Mark active" : "Mark not active"}
                          className="inline-block"
                        >
                          <input type="hidden" name="notActive" value={u.notActive ? "false" : "true"} />
                        </ActionForm>
                      )}
                      {!isSelf && (
                        <ActionForm
                          action={updateUser.bind(null, u.id)}
                          label={u.active ? "Disable login" : "Enable login"}
                          className="ml-1 inline-block"
                        >
                          <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                        </ActionForm>
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

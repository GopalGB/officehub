# Roles & Permissions

OfficeHub uses a 3-tier role hierarchy. Roles are stored in `User.role` and enforced by `src/lib/rbac.ts`. Per-project membership (`Project.members`) extends what a Member can edit beyond their own projects.

---

## The 3 roles

| Role | Visibility | Edit power | Admin power |
|---|---|---|---|
| **ADMIN** | **Everything** — every project, every task, every page | Edit anything | Create/manage users, change roles, deactivate accounts |
| **MANAGER** | **Whole team's work** — every project, every task | Edit any project, change member roster | Cannot manage users |
| **MEMBER** | **Own work + collab team** — only own projects + projects where they're added as a Member | Edit own projects + projects they're a member of | None |

This maps to what most companies actually need:
- ADMIN = founder / IT lead (rare; 1-3 people)
- MANAGER = team lead / project lead (every team has 1-2)
- MEMBER = everyone else (the default)

---

## Per-feature permissions matrix

| Action | ADMIN | MANAGER | MEMBER (owner / member of project) | MEMBER (not on project) |
|---|:-:|:-:|:-:|:-:|
| **Auth** | | | | |
| Sign in | ✓ | ✓ | ✓ | ✓ |
| Change own password | ✓ | ✓ | ✓ | ✓ |
| **Projects** | | | | |
| See on dashboard | All | All | Own + member-of | — |
| Create new | ✓ | ✓ | ✓ | n/a |
| Edit | All | All | Own + member-of | — |
| Delete | All | Own only | Own only | — |
| Add/remove members | All | All | Owner only* | — |
| Change member roster | ✓ | ✓ | Owner only | — |
| **Tasks** | | | | |
| See | All in scope | All | In own/member projects | — |
| Create | In scope | In scope | In own/member projects | — |
| Assign to anyone | ✓ | ✓ | Self or open assign | — |
| Change status | All | All | In own/member projects | — |
| Delete (own task) | ✓ | ✓ | Reporter or assignee | — |
| Delete (other's task) | ✓ | ✓ | — | — |
| **Wiki Pages** | | | | |
| Read | All | All | All | All |
| Create | ✓ | ✓ | ✓ | ✓ |
| Edit | All | All | Own only | — |
| Archive | All | All | Own only | — |
| **Team admin** | | | | |
| Create users (set password) | ✓ | — | — | — |
| Create invitation links | ✓ | — | — | — |
| Change another user's role | ✓ | — | — | — |
| Deactivate user | ✓ (not self) | — | — | — |
| **Manager view** | | | | |
| `/dashboard/manager` access | ✓ | ✓ | — | — |
| All-projects rollup | ✓ | ✓ | — | — |
| Overdue tile | ✓ | ✓ | — | — |
| **Project board / Task board** | | | | |
| View `Mine` scope | ✓ | ✓ | ✓ | ✓ |
| View `All` scope | ✓ | ✓ | — | — |
| Drag own card | ✓ | ✓ | ✓ | — |
| Drag any card | ✓ | ✓ | — | — |
| **REST API** | | | | |
| `GET /api/projects?scope=mine` | ✓ | ✓ | ✓ | ✓ |
| `GET /api/projects?scope=all` | ✓ | ✓ | — | — |
| `GET /api/users` | ✓ | ✓ | — | — |
| `POST /api/users` | ✓ | — | — | — |

\* Per-project membership upgrade in v1.7: Members of a project get edit-rights on that project even without MANAGER role. Only the project's OWNER (or MANAGER+) can change WHO is a member, though.

---

## What "collab team" means

A "team member's collab work" = projects the member has been **explicitly added to** via the project's Members card. This is the join-table model:

```
User ──< ProjectMember >── Project
```

In practice:
1. Alice creates project "Q3 Launch" → Alice is OWNER
2. Alice opens the project → Members → adds Bob
3. Bob now sees "Q3 Launch" on his dashboard, can edit it, comment, add tasks
4. Bob CANNOT add/remove other Members (only Alice or MANAGER+ can)
5. Bob CANNOT delete the project (only Alice or ADMIN can)

A MEMBER's dashboard query is:
```typescript
{ OR: [{ ownerId: me }, { members: { some: { id: me } } }] }
```
This is the `accessFilter` used across every dashboard widget — projects grid, status tiles, due-soon, recent activity, my-tasks.

---

## Changing a user's role

Only ADMIN can do this. Go to `/dashboard/team` → click the role dropdown next to a user. Change is instant (server action with toast feedback). Self-demotion is blocked (admins can't accidentally demote themselves and lock the org out of admin functions).

To make a teammate a MANAGER:
1. ADMIN opens `/dashboard/team`
2. Find the user
3. Set role to `MANAGER`
4. They now have full read across the org and can edit any project, but can't create/manage users

To revoke admin: same flow, set to MEMBER or MANAGER.

---

## What if I need a different role?

Common asks + answers:

| Request | Recommended approach |
|---|---|
| "Read-only viewer for stakeholders" | Add a `VIEWER` role in `prisma/schema.prisma`, gate edit actions in `rbac.ts`. This is a real schema change — open a PR. |
| "Per-project admin" | Already exists — the project OWNER has admin-level rights on that project even as a MEMBER globally. |
| "Department-level access" | Not built. Either: tag projects by department + filter on dashboard, OR wait for v2.2 workspaces (multi-tenant) in `docs/ROADMAP.md`. |
| "Time-bounded access (contractor expires in 30 days)" | Not built. Workaround: ADMIN deactivates the user after the date. |
| "Two-factor auth" | Not built. Auth.js v5 supports it via providers — add to `auth.ts`. |

---

## Implementation map

If you're an AI agent or contributor extending the role system, these are the files that matter:

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | The `Role` enum is the source of truth (`ADMIN \| MANAGER \| MEMBER`) |
| `src/lib/rbac.ts` | All permission helpers: `isAdmin`, `isManagerOrAbove`, `canEditProject`, `canDeleteProject`, `atLeast` |
| `src/types/next-auth.d.ts` | Session augmentation — `session.user.role` is typed as `Role` |
| `auth.ts` | The `authorize()` callback reads `role` from the DB user and writes it to the JWT |
| `auth.config.ts` | JWT + session callbacks propagate the role into `session.user.role` |
| `src/app/dashboard/*/page.tsx` | Pages call `isAdmin(session.user.role)` to gate ADMIN-only routes |
| `src/app/dashboard/actions.ts` | Every mutation re-checks RBAC server-side (don't trust the client) |
| `src/components/team/InlineRoleSelect.tsx` | The only UI for changing roles |

**Hard rule:** RBAC must be re-checked in the server action. Hiding a button in the UI ≠ security. Every mutation function in `actions.ts` starts with `requireSession()` + the appropriate `canX()` call.

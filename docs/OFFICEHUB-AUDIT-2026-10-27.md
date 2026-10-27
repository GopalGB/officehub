# OfficeHub functional and permissions audit

Date: 27 October 2026. Reviewed revision: `ead728d`.

Follow-up: [implemented fixes and verification](OFFICEHUB-FIXES-2026-10-27.md). The findings below describe the original revision.

## Outcome

The core workspace runs, but project isolation, session revocation, and wiki saving have significant defects. Fix those before relying on this installation for restricted office information.

This review combines Chromium browser checks, authenticated HTTP/server-action requests, database verification, source review, strict typechecking, a production build, and an npm dependency audit. Tests used disposable users and data in a separate local PostgreSQL schema, `officehub_audit`. No existing office records or application source were changed.

## Coverage and results

| Area | Result |
| --- | --- |
| Login | Disposable member/admin accounts signed in successfully. |
| Anonymous access | Project, user, and search APIs returned 401. Dashboard redirects to login. |
| Dashboard | Loaded; unrelated member's project list correctly excluded the private test project. |
| Project detail | Loaded, but exposed another user's restricted project to an unrelated member. |
| Project editing | Blank optional dates cause a validation failure. |
| Tasks | Creation works, including an unauthorized creation that should have been denied. Invalid filter scopes expose other users' tasks. |
| Project board | Unrelated member's default view was scoped correctly. Project collaborators incorrectly receive locked cards. |
| Task board | Loads; unexpected scope values bypass member filtering. |
| Calendar | Normal view loads. Collaborator milestones are omitted; malformed date parameters produce 500. |
| Wiki | Editor mounts. Unrelated member could rename another user's page; leaving immediately after typing loses unsaved content. |
| Team administration | Admin page loads. Admin can bypass the UI's self-demotion restriction through its server action. |
| Invitations | Create and accept succeeded; database recorded acceptance and created the account. Invalid-token view rendered. |
| Settings | Account settings view loads. Password-change implementation reviewed, not exercised. |
| Quick search | Ctrl+K opens the command palette; Escape closes it. Search API authentication checked. |
| Mobile | Project detail inspected at 375 × 812; document width remained 375px with no document-level horizontal overflow. This is a spot check, not full device coverage. |
| Strict TypeScript | Passed after Prisma client generation. |
| Production build | Completed. Initial uninitialized `public` schema emitted missing-Page-table errors during page-data collection; the isolated initialized runtime's health check passed. |
| Lint | Failed: ESLint is absent from dependencies. Build explicitly skips linting. |
| Dependency audit | 38 affected dependency entries: 4 critical, 9 high, 25 moderate. These counts include transitive packages and do not establish 38 independently exploitable application flaws. |

## Findings

### 1. High: project detail omits read authorization

**Source:** `src/app/dashboard/projects/[id]/page.tsx:82`.

An unrelated MEMBER opened `/dashboard/projects/<private-project-id>` and received HTTP 200 with the project summary, members, task, timeline, and milestone. The same account received 403 from `GET /api/projects/<id>`.

The detail page computes edit/delete permissions but never calls `canViewProject` before rendering. Enforce read access before returning project data. Include the edit-page redirect and task/search navigation paths in regression checks.

### 2. High: several project mutations only require a session

**Sources:** `src/app/dashboard/actions.ts:203`, `:225`, `:241`, `:265`, `:285`, `:294`, `:302`, `:621`.

Runtime verified that an unrelated member could:

- Add a task to the private project through the visible Add task form; database insertion confirmed.
- Complete that project's milestone through `toggleMilestone`; database change confirmed.

Source review also found missing project permission checks in project updates, enhancement creation/update, milestone creation/deletion, and comment creation. These additional operations were not all individually exercised. Mutations accepting both a child ID and a project ID must authorize the child's actual project rather than trusting the supplied project ID.

Apply a shared project authorization guard to each mutation. Hiding a control is insufficient. The older `STRIX_SECURITY_AND_BUG_AUDIT.md` describes API fixes, but equivalent server-action paths remain exposed.

### 3. High: unexpected task scopes remove member filtering

**Sources:** `src/app/dashboard/tasks/page.tsx:22`, `src/app/dashboard/tasks/board/page.tsx:29`.

For an unrelated member:

- `/dashboard/tasks` omitted the private task, as expected.
- `/dashboard/tasks?scope=unexpected` returned the private task.
- `/dashboard/tasks/board?scope=reported` also returned it; that board does not implement a `reported` scope.

Both routes only constrain recognized scopes. Validate/normalize scope first and independently apply an authorization filter to every task query. Their project dropdown queries also list all nonarchived project titles to members; this disclosure was present even on the normal Tasks view.

### 4. High: deactivation and role changes do not invalidate existing privileges

**Sources:** `auth.config.ts:12`, `src/lib/api.ts:4`, `src/app/dashboard/actions.ts:79`.

Signed in as a disposable ADMIN, then changed its database record to MEMBER and `active=false`. The existing session still received HTTP 200 from `/api/users`.

JWT role is populated at sign-in and reused without checking current account state. Recheck active status and current role on protected server operations, or introduce a session version/revocation mechanism. Verify password changes and administrator password resets invalidate old sessions if that is the intended policy.

### 5. High: wiki editing permissions differ from the documented policy

**Sources:** `src/app/dashboard/pages/[id]/page.tsx:64`, `src/app/dashboard/actions.ts:986`, `:1007`; policy: `docs/ROLES.md`.

An unrelated MEMBER received an editable BlockNote surface and successfully renamed another user's page. Database verification confirmed the title change. The content-saving action likewise only requires a session.

The role guide says members edit their own pages. Apply that rule to metadata/content actions and pass an explicit edit permission to the editor. If collaborative editing is intended instead, establish that policy explicitly and update the documentation and UI together.

### 6. High: leaving the wiki before its timer runs loses edits

**Source:** `src/components/pages/PageEditor.tsx:35`.

Typed a unique marker into the actual editor, confirmed it was visible, then navigated to Dashboard immediately. The marker was absent from the stored document. There is no flush-on-navigation or unsaved-change protection; the five-second interval is cleared on unmount.

Save dirty changes reliably before leaving and expose save failures. Also address these source-reviewed risks: the interval saves unchanged documents, lacks conflict/version checks, and has no error catch. Stale simultaneous editors can overwrite changes; multiuser conflict behavior was not reproduced in this review.

### 7. Medium: ordinary project edits fail when dates are blank

**Sources:** `src/app/dashboard/actions.ts:160`, `src/lib/validation.ts:37`, `src/components/project/ProjectForm.tsx`.

Submitting `updateProject` with valid title/status/priority and empty `startDate`/`targetDate` produced HTTP 500 and `Invalid datetime`. Creation permits these fields to be blank; editing forwards empty strings into a schema that accepts null/undefined but not empty strings.

Normalize blank dates consistently and present inline validation feedback. Include clearing an existing date in the verification.

### 8. Medium: documented self-demotion protection exists only in the UI

**Source:** `src/app/dashboard/actions.ts:350`; UI: `src/app/dashboard/team/page.tsx`.

Calling the admin's own `updateUser` action with `role=MEMBER` succeeded; database role changed to MEMBER. The UI disables the self-role dropdown, but the server action has no equivalent rule. Self-deactivation is also not guarded in the action, based on source review.

Reject prohibited self-changes server-side and preserve at least one active administrator. This matters independently of the stale-session defect.

### 9. Medium: collaborator permissions are inconsistent across views

**Sources:** `src/components/project/ProjectBoardClient.tsx:86`, `src/app/dashboard/calendar/page.tsx:53`, `src/components/task/TaskBoardClient.tsx:86`, `src/app/dashboard/tasks/page.tsx:110`.

The collaborator account was explicitly on the private project. Its project appeared on the board, but its sortable card had `aria-disabled=true`: client permission logic allows only owner/manager. The collaborator's calendar omitted the project's dated milestone because that query only checks project ownership.

The task board and global task table also use narrower edit rules than the server's project-member rule, based on source review. Derive per-record permissions consistently and include membership in calendar visibility.

### 10. Medium: malformed URL filters cause server errors

**Sources:** `src/app/dashboard/calendar/page.tsx:41`, `src/app/dashboard/tasks/page.tsx:29`.

Verified HTTP 500 for `/dashboard/calendar?y=bad&m=bad` and `/dashboard/tasks?status=bad`. Validate date ranges and enum filters before creating dates or calling Prisma. Return a useful validation response or fall back to defaults.

### 11. Medium: due-today handling is inconsistent

**Sources:** `src/components/task/TaskTable.tsx:99`, `src/components/project/ProjectCard.tsx:23`, `src/lib/utils.ts:14`.

Source review: the calendar and Kanban cards use the calendar-day helper, while table/project cards compare a UTC-midnight deadline directly with the current timestamp. A due-today item can appear overdue during that day. Use the existing helper consistently and verify date-only formatting in both positive and negative UTC offsets. Cross-timezone browser behavior was not tested here.

### 12. Dependency advisories and incomplete lint tooling

**Sources:** `package.json`, `package-lock.json`, `next.config.ts:10`, `.github/workflows/ci.yml`.

The npm audit identified affected pinned Next.js 15.1.6, Auth.js, and other dependencies. Next.js advisories include React Flight remote code execution ([GHSA-9qr9-h5gf-34mp](https://github.com/advisories/GHSA-9qr9-h5gf-34mp)) and middleware authorization bypass ([GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw)). These framework vulnerabilities were not exploited during this review. Prioritize updating supported patched versions and rerun build and functional checks; do not blindly apply major dependency upgrades.

`npm run lint` fails because ESLint is not installed. The build skips linting and CI has no separate lint job despite the config comment saying otherwise. Install the configured lint dependencies, use a matching lint command, and add an actual CI check.

## Useful user shortcuts and workflow tips

- **Quick jump:** Ctrl+K on Windows/Linux or Cmd+K on macOS. Arrow keys select a result, Enter opens it, Escape closes the palette. Opening/closing was browser verified; result keyboard navigation was reviewed in code.
- **Rich notes:** Type `/` in a project description or wiki editor to access BlockNote blocks. The editor mount was checked; individual block formats were not exhaustively exercised.
- **Boards:** The UI documents Tab to focus a card, Space to grab/drop, arrow keys to move, and Escape to cancel. Project cards also handle Enter to open the project. Full drag/keyboard movement was not exercised.
- **Task filters:** “Assigned to me” differs from “Reported by me.” Unassigned tasks you create will appear in the latter. Managers/admins also get All. Use the visible filters while the invalid-scope defect is repaired.
- **Project members:** Adding a collaborator is intended to grant project editing without granting the global Manager role. Only the owner or manager/admin can change the member roster. Board/calendar behavior currently needs the corrections above.
- **Pinned work:** Star a project card to surface it in the dashboard's Pinned section. This was reviewed in code, not click-tested.
- **Onboarding:** Admin → Team → invitation link lets a teammate choose their own password. Link creation and acceptance were verified; this flow does not send an email itself.
- **Wiki saving:** For the current implementation, wait for saving to finish before leaving. Immediate navigation was verified to lose recent typing. Archived pages currently have no UI restore workflow.
- **Mobile:** Use the header menu for navigation. Search has no visible mobile trigger because the desktop search button is hidden below the medium breakpoint; keyboard Ctrl/Cmd+K still exists for devices with a keyboard.

## Recommended repair order

1. Patch affected framework/auth dependencies, enforce project reads/writes, and constrain every task query by actual permissions.
2. Enforce current account state and role on protected operations; guard admin self-changes and the last administrator.
3. Fix wiki ownership and save durability, then add focused regression coverage for unauthorized users and navigation before save.
4. Normalize dates/filters, align collaborator behavior, and make lint runnable in CI.

## Limits

This is a broad local audit, not an exhaustive security assessment or verification of a deployed OfficeHub instance. External hosting/proxy behavior, backup restoration, production secrets, load/concurrency, every API payload, every editor block, full accessibility, and every mobile route were not tested. No application fixes or dependency upgrades were applied as part of this check.

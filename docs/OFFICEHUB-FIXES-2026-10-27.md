# OfficeHub audit fixes

Implemented the findings from [the audit](OFFICEHUB-AUDIT-2026-10-27.md). Changes are in the repository; no live deployment was performed.

## Changes

| Audit finding | Resolution |
| --- | --- |
| 1. Project detail disclosure | Project queries include the viewer's access predicate before retrieving details. Read and edit pages reject unrelated members. |
| 2. Unauthorized project mutations | Shared project guards cover updates, enhancements, milestones, comments, tasks, and favorites. Child operations verify the child's actual project. |
| 3. Task scope bypass | Scope normalization and a separate project access predicate apply to every task query. Project dropdowns are scoped too. |
| 4. Stale account privileges | Server sessions check current active status and role. Password changes invalidate earlier JWTs through a credential fingerprint. |
| 5. Wiki write permissions | Members can edit their own pages; managers/admins can edit all. Other members receive a read-only editor. |
| 6. Wiki edit loss | Dirty-only autosave, Save now, save-before-link-navigation, unload protection, and recoverable device drafts replace the fixed interval. Atomic timestamp checks reject stale edits rather than overwriting newer work. |
| 7. Blank project dates | Empty optional dates normalize to null; clearing a date works. Invalid dates produce validation feedback. |
| 8. Admin self-changes | Server rejects self-demotion/deactivation. Serializable transactions preserve an active administrator. |
| 9. Collaborator inconsistencies | Project/task boards and task tables receive record-specific permissions. Calendar includes collaborator milestones. My projects provides a scoped team-task view. |
| 10. Malformed filters | Invalid task statuses and calendar periods fall back safely. Invalid API project statuses return a validation response. |
| 11. Due-today inconsistencies | Task tables and project cards use calendar-day overdue checks. Date-only labels retain the UTC calendar day across timezones. Calendar date arithmetic uses UTC consistently. |
| 12. Dependencies and lint | Upgraded Next.js, React, Auth.js, BlockNote/Mantine, Zod, PostCSS, and tooling. Patched the transitive PostCSS dependency with an override. Lint and test jobs now run in CI. |

Mobile users also have a visible search button. People search navigation is shown only to admins, who can access the Team destination.

The Zod upgrade required explicit optional status/priority fields in update schemas: Zod 4 otherwise applies creation defaults during partial edits. A regression test covers this compatibility behavior.

## Validation

- Strict TypeScript: passed, including unused-local/parameter checks.
- ESLint: passed with typed correctness, Next.js, and security rules. Generated Next.js files are excluded.
- Unit regression suite: 12 passed.
- PostgreSQL integration suite: 4 passed against a separate `officehub_test_permissions` schema. Test fixtures were removed afterward.
- Chromium/authenticated runtime checks: 43 assertions passed across access denial, mutation guards, collaborator behavior, malformed filters, blank-date editing, admin self-protection, revocation, wiki saving/conflicts/recovery, and mobile search.
- Production build: passed with Next.js 15.5.28.
- `npm audit`: zero reported vulnerabilities across installed dependencies at verification time.

The runtime checks used disposable accounts in `officehub_audit`, including an unrelated member and an explicit collaborator. They verified database side effects, not just HTTP success statuses. The draft recovery check included an abrupt browser closure with unsaved content.

## Running the checks

```sh
npm ci
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run lint
npm test
npm run build
npm audit
```

The database integration suite requires `OFFICEHUB_TEST_DATABASE_URL` to point to a dedicated PostgreSQL schema whose name begins with `officehub_test_`. Initialize that schema first:

```sh
DATABASE_URL="$OFFICEHUB_TEST_DATABASE_URL" npx prisma db push --skip-generate
npm run test:integration
```

Never use an office-data schema for these tests. CI provisions and initializes its own test schema.

## Deployment notes

No database schema migration is required. Install the updated lockfile, build, and restart the application through the existing deployment process. Existing users will need to sign in again because older JWTs do not contain the new credential fingerprint. Password changes also require fresh sign-in.

Wiki recovery drafts belong to the signed-in user on that browser/device. They are a recovery mechanism, not shared storage or real-time collaborative editing. A stale-save conflict requires reloading the latest page before choosing whether to restore a local draft.

Production hosting, backup restoration, load testing, and full accessibility/device coverage remain outside this repair's verification scope.

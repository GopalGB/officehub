# OfficeHub 0.2.0 — project workspace

This release organizes work around projects, reports, and enhancements, with a personal weekly planner and management request pool. The Catalyst Brands logo wrapper is transparent and uses the optional local root `logo.png` unchanged.

## Included

- Owner and sub-owner, project type and source lineage, success criteria, estimates, expected weekly savings, and delivery dates.
- A project journey chart that keeps the original completion date separate from enhancements during or after delivery; individually editable enhancement releases and milestone deadlines.
- Reports with notes, document links, owners, due dates, effort, table/board views, and version checks. Existing task rows and IDs are preserved; old bookmarks redirect.
- Weekly focus blocks, date-specific adjustments/skip/reset, copy previous week, daily timeline, overlap warnings, and management workload visibility for a selected date.
- NRF 4-5-4 fiscal weeks/periods/quarters and 53-week years, with configurable company year alignment.
- Expiring, revocable intake form links; validated requests stay in a pool and management assigns them transactionally to project owners.
- Immutable project detail versions, restore as a new version, and before/after history for project work. History is paged and loaded only in the History tab. Wiki behavior remains its existing conflict checks and local draft recovery.
- A Windows normal-user updater with a database backup before schema changes, preservation of local settings/logo/logins, exact handling of the earlier Windows standalone adjustment, and restart on port 8599.

## Validation

- Strict TypeScript and ESLint.
- 18 unit tests, including NRF year boundaries from 2000–2100, week 53, day overrides, workload overlap, co-owner permissions, and safe report URLs.
- 9 PostgreSQL integration tests in an isolated `officehub_test_*` schema, including unauthorized writes, immutable baselines, competing versioned edits, and independent weekly/daily records.
- 28 browser checks: owner/sub-owner and project journey, edit/restore, report editing, enhancement creation/editing, milestone deadline editing, weekly/daily planning, request submission/assignment, manager visibility, access denial, and 375px mobile layouts.
- A separate upgrade from the previous main-branch schema with existing accounts/projects/tasks verified preservation of IDs, statuses, story points, and password hashes without data-loss flags.
- PowerShell scripts parsed and the updater exercised with a real temporary Git repository plus simulated Windows/native commands. The test covers fast-forward updates, the known Windows config change, backup order, unchanged credentials/logo, IP selection and port 8599, local-edit rejection, and stopping on build failure. It runs in CI as well. This is not a test on the user's actual Windows server or office network.
- Production Next.js build. Runtime dependencies remain pinned; no new runtime packages were added.

## Deployment and history boundaries

Follow [Windows update instructions](WINDOWS.md). Stop the existing terminal first; the updater does not kill other processes, install services, or change firewall, certificate-store, PATH, execution-policy, or network settings. It updates app code, app database structure, and app callback URLs. PostgreSQL's existing account permissions are required.

Existing data is preserved in place. The first project edit saves a baseline; previously unrecorded historical edits cannot be reconstructed. Project restoration does not roll back reports, enhancements, or work plans; those changes stay in the audit history. See the [workspace guide](PROJECT-WORKSPACE.md) for the exact permission and version boundaries.

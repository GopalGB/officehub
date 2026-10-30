# AGENTS.md — Guide for AI Coding Agents

> Read this **first** if you're an AI coding agent (Codex, Cursor, Claude Code,
> Aider, etc.) working on this repository. It packs the project's invariants,
> conventions, and "how to add X" recipes into a single page so you don't have
> to re-derive them from grep.

This file follows the [`AGENTS.md` convention](https://agents.md) — recognized by
OpenAI Codex, Cursor, and most other AI coding tools. Place any agent-specific
instructions for this project here.

---

## Project: OfficeHub

A self-hosted Notion + Jira hybrid for offices. Track projects, tasks, pages,
timelines. Built so a small team can run their whole operation on a single
Linux server.

**Stack:** Next.js 15.5.28 (App Router, server components, server actions) ·
React 19 · TypeScript (strict) · Postgres 16 · Prisma 5 · Auth.js v5 ·
BlockNote 0.56 · TailwindCSS · Docker Compose.

---

## TL;DR for agents

1. **TypeScript strict mode is on.** Never use `any`. Prefer `unknown` +
   narrowing or a typed Zod schema.
2. **Server actions are in `src/app/dashboard/actions.ts`.** New mutations go
   there. Validate inputs with a Zod schema from `src/lib/validation.ts`.
3. **REST endpoints under `src/app/api/**/route.ts`.** Use `requireApiAuth`
   from `src/lib/api.ts` for auth + `jsonOk` / `jsonError` for responses.
4. **RBAC lives in `src/lib/rbac.ts`.** Every mutation must check edit/delete
   permission via the helpers there. `canEditProject` must receive
   `memberIds` — projects have multi-member access.
5. **Forms use server actions, not API routes.** API routes are for external
   automation. UI forms post directly to server actions.
6. **All `Read /Write` of dates uses `formatDate` / `timeAgo` from
   `src/lib/utils.ts`** — never call `date-fns` directly in UI code.
7. **BlockNote hooks (`useCreateBlockNote`) crash during SSR.** Always wrap
   in a mount guard — see `BlockEditor.tsx` and `BlockReader.tsx` for the
   pattern.
8. **Server actions passed as props to client components must be bound at the
   top level**, not via inline arrow closures. Use `.bind(null, projectId)`.
9. **No `output: "standalone"` in dev mode** — it conflicts with HMR.
   `next.config.ts` already guards this.

---

## Directory layout

```
.
├── AGENTS.md                       # you are here
├── README.md                       # user-facing quickstart
├── prisma/
│   ├── schema.prisma               # source of truth for the data model
│   └── seed.ts                     # admin bootstrap + starter tags
├── auth.ts, auth.config.ts         # Auth.js v5 — credentials provider, JWT
├── middleware.ts                   # route protection
├── docker-compose.yml              # Postgres + app
├── Dockerfile                      # multi-stage standalone build
└── src/
    ├── app/                        # Next.js App Router
    │   ├── layout.tsx              # root layout + ThemeProvider
    │   ├── login/, signup/, invite/[token]/
    │   ├── dashboard/
    │   │   ├── layout.tsx          # sidebar + header + toast provider + cmd-k
    │   │   ├── page.tsx            # dashboard home
    │   │   ├── actions.ts          # ALL server actions live here
    │   │   ├── projects/, tasks/, pages/, calendar/, board/, manager/, team/, settings/
    │   └── api/                    # REST: /me, /projects, /users, /search, /health
    ├── components/
    │   ├── ui/                     # primitives (button, input, card, badge, ...)
    │   ├── layout/                 # Sidebar, Header, MobileNav, CommandPalette, ThemeToggle
    │   ├── editor/                 # BlockNote wrappers (BlockEditor, BlockField, BlockReader)
    │   ├── project/, task/, pages/, team/, dashboard/
    │   └── ...
    ├── lib/
    │   ├── db.ts                   # Prisma client (singleton)
    │   ├── auth.ts                 # re-exports / helpers
    │   ├── rbac.ts                 # canEditProject, canDeleteProject, isAdmin, etc.
    │   ├── validation.ts           # Zod schemas — one per entity
    │   ├── api.ts                  # REST helpers: requireApiAuth, jsonOk, jsonError
    │   ├── utils.ts                # cn(), formatDate(), timeAgo(), initials()
    │   ├── colors.ts               # deterministic name → palette mapping
    │   ├── invitations.ts          # token generator + url builder
    │   └── pageTemplates.ts        # Notion-page starter templates
    └── types/next-auth.d.ts        # session augmentation (role: Role)
```

---

## Commands

```bash
# Local dev (Postgres in Docker)
docker-compose up -d db            # OR: docker compose up -d db
npm run dev                        # http://localhost:3000

# Database
npx prisma db push                 # apply schema (no migration history)
npx prisma migrate dev --name X    # proper migration
npm run db:seed                    # create admin + starter tags

# Quality
npx tsc --noEmit                                   # typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters  # strict
npm run build                                       # full build + typecheck

# Codex CLI workflow
codex review                       # diff review with pass/fail gate
codex challenge                    # adversarial — tries to break it
codex consult "question"           # ask for a second opinion
```

---

## How to add a new entity end-to-end

Recipe: adding `Sprint`.

### 1. Schema (`prisma/schema.prisma`)
```prisma
model Sprint {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  startDate DateTime
  endDate   DateTime
  goal      String?
  tasks     Task[]   @relation("SprintTasks")
  createdAt DateTime @default(now())
  @@index([projectId])
}
```
Then `npx prisma db push && npx prisma generate`.

### 2. Validation (`src/lib/validation.ts`)
```ts
export const sprintCreateSchema = z.object({
  name: z.string().min(1).max(80),
  startDate: z.string(),
  endDate: z.string(),
  goal: z.string().max(500).optional().nullable(),
});
```

### 3. Server actions (`src/app/dashboard/actions.ts`)
```ts
export async function createSprint(projectId: string, formData: FormData) {
  const user = await requireSession();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { id: true } } },
  });
  if (!project) throw new Error("Project not found");
  if (!canEditProject({
    viewerRole: user.role, viewerId: user.id,
    ownerId: project.ownerId,
    memberIds: project.members.map((m) => m.id),
  })) throw new Error("Forbidden");

  const parsed = sprintCreateSchema.safeParse({ /* ... */ });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);

  await db.sprint.create({ data: { ...parsed.data, projectId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}
```

### 4. UI (client component for forms, server for lists)
- Client form posts to the action via `<form action={createSprint.bind(null, projectId)}>`
- Server component fetches with `db.sprint.findMany(...)` and renders.

### 5. Optional REST endpoint (`src/app/api/projects/[id]/sprints/route.ts`)
Same shape as existing endpoints. Use `requireApiAuth`.

### 6. Wire into sidebar / page if needed.

---

## Conventions cheat sheet

| Concept | Convention |
|---|---|
| Imports | `@/*` → `src/*`. Always use the alias, never `../../..` |
| Server actions | `"use server"` at top of file. Validate via Zod. Return `{ error: string } \| { ok: true }` for forms that need inline errors, throw `Error` for action-on-click. |
| Client components | `"use client"` at top. Mount-guard BlockNote. Use `useTransition` for action calls. |
| Optimistic UI | `useState` set first, then `start(async () => { await action(); })` — revert on catch. |
| Toasts | `useToast()` returns `{ toast(message, variant) }`. Variant: `"success" \| "error" \| "info"`. |
| Avatars | `<Avatar name={user.name} size="sm \| md \| lg" />` — colors derived from name hash. |
| Dates | `formatDate(d)` for short, `formatDateTime(d)` for full, `timeAgo(d)` for relative. |
| Permissions | Always go through `src/lib/rbac.ts` helpers. Pass `memberIds` to `canEditProject`. |
| Loading | Use `<Skeleton />` for placeholders. |
| Animations | Add `.hover-lift` to cards. Use `.animate-fade-in` for page reveals. Respect `prefers-reduced-motion` — handled in globals.css. |
| Dark mode | Dark mode is disabled. Use Catalyst theme tokens; see `docs/BRANDING.md`. |

---

## Things to AVOID

| Anti-pattern | Why | Right thing |
|---|---|---|
| `console.log` in committed code | Floods server logs | Remove before commit, or use a real logger |
| `any` in TypeScript | Defeats the strict mode that catches bugs | `unknown` + narrowing, or a Zod schema |
| Raw SQL via `$queryRaw` | Bypasses Prisma's type safety | Use Prisma methods unless there's a documented reason |
| New API route for a UI form | Adds duplicate validation | Server actions are first-class for forms |
| Inline arrow `(fd) => action(id, fd)` as a Server Component → Client Component prop | Crashes at runtime (server action prop boundary) | `action.bind(null, id)` |
| `useCreateBlockNote()` without mount guard | SSR crash: `document is not defined` | Wrap in `useEffect(setMounted, []) + if (!mounted) return null` |
| Editing the schema without `npx prisma db push` | DB drifts from code | Always push + regenerate after schema changes |
| Committing `.env` | Secret leak | Pre-push hook blocks it, but don't even try |

---

## Test loop

Regression tests use Node’s test runner through tsx. Run `npm test` for unit checks.
For database permission tests, initialize a separate `officehub_test_*` schema, set
`OFFICEHUB_TEST_DATABASE_URL` to it, and run `npm run test:integration`.
Never point these tests at office data. CI runs both suites. Additional checks:

1. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — must be zero
2. `npm run build` — must finish without error
3. `npm run dev` + manual click-test the affected flow
4. `curl -s http://localhost:3000/api/health` — must return `status: ok, db: ok`

When adding a new mutation, also test:
- Anonymous request → 401 or redirect to `/login`
- Wrong-role request (e.g. MEMBER trying to delete someone else's project) → 403
- Happy path → 200/201 + side effect visible

---

## Code review checklist

Before opening a PR:

- [ ] `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` is clean
- [ ] `npm run build` succeeds
- [ ] Every new server action validates input via a Zod schema
- [ ] Every new server action checks RBAC before mutating
- [ ] Every project-touching server action passes `memberIds` to `canEditProject`
- [ ] No `.env` or credential files in the diff
- [ ] Catalyst tokens and semantic status colors keep readable contrast
- [ ] Mobile: layout works at 375px (test via DevTools responsive)
- [ ] BlockNote-touching code respects the mount-guard pattern
- [ ] If you added a route, sidebar + mobile nav include it (if user-facing)

---

## Codex CLI integration

OpenAI Codex CLI works out of the box with this repo. Recommended commands:

```bash
# Independent code review of your current diff (best for catching bugs)
codex review

# Adversarial: ask Codex to try to break your code
codex challenge

# Open consultation thread (e.g. "is this RBAC check correct?")
codex consult "Does setProjectTags properly enforce member permissions?"
```

Codex reads this file (`AGENTS.md`) for project context. If you're extending
Codex's prompts for this repo, point it at:

- `AGENTS.md` — agent instructions (this file)
- `docs/ARCHITECTURE.md` — system design rationale
- `docs/API.md` — REST API reference
- `prisma/schema.prisma` — data model
- `src/lib/rbac.ts` — auth rules

---

## When in doubt

- Look at how an existing feature does it (e.g. Tags for many-to-many, Tasks
  for entity-with-status, Invitations for token-gated flows).
- The latest 5 commits describe their intent in detail. `git log --stat -5`.
- If a pattern feels missing, propose it in a new section of this file rather
  than diverging.

---

## Version

This file moves with the code. Update it when:
- The directory layout changes
- A new entity / pattern is introduced
- A new convention is locked in via PR feedback

Last meaningful change: v1.5 (favorites + dark mode + Cmd+K + Calendar + Wiki templates).

## Authorization and wiki saving

- Node auth refreshes role and active state on every session access. JWTs carry a
  credential fingerprint so password changes revoke earlier sessions. Edge middleware
  is only the initial route gate; all sensitive work must use the Node auth instance.
- Project child mutations use `requireProjectEditor` from `src/lib/access.ts`.
  Check a child's real project before editing it. Combine client filters with
  `projectAccessWhere` using AND; unknown scopes must never remove authorization.
- Wiki saves use the single `savePage` action, author/manager permissions, and an
  `expectedUpdatedAt` timestamp. Preserve optimistic conflict checks and local draft
  recovery when changing the editor. Never autosave an unchanged read-only page.
- Zod 4 applies defaults inside partial objects. Update schemas explicitly override
  status/priority with optional enum schemas so partial edits cannot reset them.

## Branding

The app uses the Catalyst Brands theme. Keep logo rendering in `BrandIdentity` and
the optional root `logo.png` behind `/brand/logo`; do not hard-code a remote image
or require a file to exist for startup. Preserve `outputFileTracingIncludes` so a
supplied logo reaches standalone/Docker builds. See `docs/BRANDING.md` for sources
and deployment instructions. Use theme tokens for new controls and keep text contrast.


## Project workspace (2026-10-28)

- User-facing work items are Reports (`/dashboard/reports`); the Prisma `Task` model and legacy redirects preserve existing data. Do not drop or rename that table during upgrades.
- Projects have `coOwnerId`; include it in all RBAC checks and selectors alongside owners and explicit collaborators. Use `projectAccessWhere` for reads.
- Project mutations use `reviseProject` from `src/lib/history.ts` in the write transaction. It preserves a baseline, increments the version, saves the immutable snapshot, and audits changes. Child mutations use `recordAudit` in the same transaction. Never audit password hashes, credentials, or tokens.
- Additional project columns use the validated ordered `additionalDetails` array of label/value strings (up to 50 fields, 100-character labels, 5,000-character values). Preserve leading zeros, paths, and omitted values on unrelated updates. Explicit empty arrays clear the fields. Include the fields and sub-team in revisions and readable history; keep workbook data out of the repository.
- Excel import uses `project-workbook.ts` for bounded local parsing, `project-import.ts` for pure row validation, and `project-import-service.ts` for manager-only preview/commit. Preview JSON is server-stored, creator-scoped and expiring; clear its rows after a successful commit while retaining the retry result. `ProjectImportRecord` keys (list/sheet/reference) prevent duplicates; commit is serializable, checks preview versions, and saves revisions/audit atomically. Batch imported enhancements with `createManyAndReturn` and `recordAudits`, matching returned IDs by normalized title rather than return order. Existing matches require the explicit update checkbox; blank cells, rosters, dates, unrelated fields, and previously imported timeline edits are preserved. Never infer delivery dates or parent-project relationships from import time or similar titles. Keep workbook data and uploads out of Git and use synthetic committed tests only.
- Office deployments use plain HTTP on an internal IP. Browser-only row keys must work without secure-context APIs such as `crypto.randomUUID`; use a local counter outside React state updater callbacks. Business IDs and security tokens remain server-generated.
- The overview starts with the project timeline and its add-change control. Use `deliveryRange` and `chronologicalStages`: a deadline without a start is a point, missing dates remain unscheduled, and invalid actual intervals need a visible review hint. New enhancements must not rewrite the original project's delivery dates.
- Project board queries use `projectBoardFilters`; managers can choose all work, while members stay scoped to ownership, sub-ownership and explicit collaboration even with forged scope/owner filters. CSV export uses only the already-authorized displayed board rows (up to 500), includes additional columns, and neutralizes spreadsheet formulas. Never include user credentials or unscoped data in client export props.
- Drag overlays must be portalled to `document.body`: transformed page animations create a containing block that offsets fixed overlays. Keep the overlay mounted, use dedicated accessible move handles, constrain its viewport geometry, and return no pointer collision outside the board. Preserve the drag-start snapshot for cancellation and outside drops; block new moves during saves and reconcile refreshed server data.
- Team summary counts exclude archived projects/Admin identities and deduplicate each person's owner/sub-owner/member roles. Completion means completed project status; remaining is every other non-archived status. Shared work counts once for each assigned person. The manager route remains server-guarded. Journey animations must respect reduced motion, and bars/endpoint markers must stay within their tracks.
- Project restores create a new version and are owner/manager-only. They restore project details/roster/tags, not child work. Reports and enhancements have independent version checks.
- Weekly plans belong to the user; `DailyOverride` applies only inside that plan's selected week and weekdays. Use `plannedDay` / `dayLoad` instead of materializing daily tasks.
- Retail dates use `src/lib/fiscal.ts`: the supplied official FY2026–2028 calendars take precedence over saved settings. FY2026 starts 2026-02-01 (52 weeks), FY2027 starts 2027-01-31 (52), FY2028 starts 2028-01-30 (53, extra week in P12). Other years use configurable NRF 4-5-4. Original PDFs are in `public/fiscal-calendars`; all 157 week rows are checked against fixtures extracted from those PDFs.
- Admin accounts are administrative identities, not delivery staff. Use `assignablePeopleWhere` for allocation/workload queries and `assertAssignablePeople` for new allocations. Preserve legacy assignments when editing unrelated details, but never newly allocate an Admin through ownership, collaborators, report assignments, API creation, intake assignment, or version restore.
- Allocation edit forms use a generic keep-current choice for existing ineligible owners/assignees and omit those unchanged fields before submission. Do not put Admin IDs into the options. Keep existing roster members visible separately from eligible additions, validate only new IDs, and require explicit removal of existing members. Docker startup uses the same guarded schema-push strategy as Windows; there is no committed migration baseline to deploy.
- Request forms require the requester’s reporting manager and team as text. SOP/source paths are stored as text without fetching files from those paths. SOP uploads are limited to 3 MB PDF/DOCX/UTF-8 TXT and stored in database bytes so ordinary database backups preserve them. Use `requestDetailsSelect` on lists and audit snapshots to exclude file bytes. Serve downloads only through the authenticated SOP route to managers or the assigned project team, as attachments with no caching or content sniffing.
- Public `/request/[token]` pages validate unguessable expiring/revocable links without granting workspace access. Re-check manager active state and role at submission. Manager decisions are transactional and version-checked. No outbound messaging occurs.
- Windows updates use `scripts/update-windows.ps1`. Preserve the no-admin workflow: no execution-policy, firewall, service, PATH, certificate-store, or PostgreSQL-server changes; no schema data-loss flags; a database backup precedes schema application.
- The Windows config guard recognizes the earlier standalone adjustment plus the known PowerShell 5.1 UTF-8 dash corruption in full-line comments. Preserve the original file in backups; compare actual setting names and values case-sensitively. Do not normalize string literals or discard other custom settings to make an update proceed.
- Use per-command `maintenance.auto=false` / `gc.auto=0` and fetch `--no-auto-gc` in the Windows updater and its bootstrap to avoid locked-pack cleanup prompts. Do not persist those settings or delete Git object files. Locate existing PostgreSQL utilities through service/installation metadata as well as product directories; do not assume C: or a fixed list of PostgreSQL major versions.
- Preserve the explicit PostgreSQL utility override. Probe automatic candidates against the configured database with `backup-db.mjs --check-client` and skip incompatible clients. The probe discards a read-only schema export; the full database backup must still succeed before applying schema changes. Mock PATH lookup in service-discovery tests so installed developer tools cannot mask the fixture.
- Keep the logo wrapper transparent. The root `logo.png` is local deployment content and ignored by Git.

## Simple project presentation (2026-10-30)

- Primary project sections are Overview, Work, History. Legacy details/reports/
  enhancements/activity links must still open the relevant content. Timeline
  change links depend on this behavior. Keep optional metadata and schedule in
  accessible disclosures; do not delete data to simplify the interface.
- Closed optional form sections remain mounted and submitted. Reveal ancestor
  disclosures during native validation and reveal optional details for action
  errors so invalid fields can be corrected.
- Projects contains the Cards/Board switch and manager Excel import entrypoint;
  these do not need duplicate primary navigation items.

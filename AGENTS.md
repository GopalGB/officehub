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

**Stack:** Next.js 15.1.6 (App Router, server components, server actions) ·
React 19 · TypeScript (strict) · Postgres 16 · Prisma 5 · Auth.js v5 ·
BlockNote 0.31 · TailwindCSS · Docker Compose.

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
| Dark mode | All custom colors must have a `dark:` variant. Use shadcn-style HSL CSS vars. |

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

We don't have a Jest/Vitest setup yet (planned). Until then, your safety net is:

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
- [ ] Dark mode: every new color has a `dark:` variant
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

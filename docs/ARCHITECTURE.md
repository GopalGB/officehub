# Architecture

## Goals

1. **Self-hostable in one command.** No SaaS dependencies, no SSO requirement, no external services beyond Postgres.
2. **Notion-like UX where it matters.** Block editor for descriptions and status updates. Plain text where it doesn't (titles, comments, milestones).
3. **Manager-grade rollup.** A single page that shows the state of every project, every owner, every overdue item.
4. **Small surface area.** Office tools that grow beyond their use case become unmaintainable. We resist this by keeping the data model and feature set tight.

## Non-goals (v1)

- Real-time collaborative editing — single-user editing is fine; conflicts are rare in this UX.
- Mobile apps — responsive web is enough.
- SSO / SAML — email + password covers an office; SSO is a v2 lift.
- File attachments and image embedding — schema supports a future upload pipeline; not wired yet.

## Stack Decision (2026-05-22)

> Output of the build-vs-fork research run. Sources at the bottom.

**Approach:** Build clean. Do **not** fork Plane or Outline.

**Final stack:**
- Framework: Next.js 15 (App Router) + TypeScript
- DB: PostgreSQL 16 + Prisma 5
- Editor: **BlockNote** 0.31 (MPL-2.0)
- Auth: **Auth.js v5** with the Prisma adapter (credentials provider, JWT sessions). Better-Auth migration tracked in ROADMAP.md.
- Deploy: Docker Compose, single Linux host

### Q1 — Fork vs Build Clean

| Candidate | Verdict | Why |
|---|---|---|
| Plane (makeplane/plane) | REJECT | Stack is Next.js front + Django/Celery/MinIO back — 5 extra services to maintain for a 10-50 user app. AGPL-3.0 contaminates any future hosted spin-out. |
| Outline (outline/outline) | REJECT | Node+React stack fits, but it's a **wiki, not a PM tool** — no rollup, no enhancement proposals, no status timeline primitives. BSL 1.1 until 2030-03-18. |
| AppFlowy | DQ | Flutter desktop-first, not web-native. |
| Affine / Focalboard | DQ | Over-scoped / discontinued. |
| **Build clean + BlockNote** | **PICK** | Schema is ~6-8 tables. BlockNote ships 80% of the editor UX. Net effort is lower than retrofitting Plane or Outline. |

### Q2 — Block Editor Ranking

1. **BlockNote** — Notion-like UI works out of the box; built on Tiptap+ProseMirror so the foundation is the same as Tiptap's. Active, MPL-2.0.
2. Tiptap — Headless. More flexible but you build the slash menu, drag handles, and block UI yourself.
3. Plate — Slate-based plugin system. Powerful but Slate has known performance ceilings at long-document scale.
4. Editor.js — Mature but JSON-only output, weaker collab story.

**Pick:** BlockNote — fastest path to a Notion-feel UX with the least custom code, and you can drop to Tiptap primitives if you outgrow it.

### Q3 — Auth Library

**Pick: Auth.js v5 (NextAuth) for v1; Better-Auth as a v2 migration target.**

The research recommendation was Better-Auth (TypeScript-first, built-in RBAC + organisations + email-password). For v1 we chose Auth.js because:

- The Account/Session schema is mature and battle-tested across thousands of production apps.
- Credentials provider + a custom role field on the User model gives us everything we need.
- Auth.js v5 is in beta but stable enough for a small office app.

Better-Auth migration goes to `docs/ROADMAP.md` for v2 with a measured switchover plan (parallel-run, dual-write, cut over).

### Watch-outs

- BlockNote is an abstraction on Tiptap. If year-2 needs deeply custom block types, expect to drop to Tiptap.
- Members can only see their own projects in v1. If you need "team projects" or shared ownership, schema supports a join-table extension — see ROADMAP.
- Postgres connection comes from `DATABASE_URL`. To swap to SQLite for a smaller deployment, see DEPLOY.md.

## Data Model

```
User                — auth + roles
├── ownedProjects (Project[])
├── authoredUpdates (ProjectUpdate[])
├── authoredEnhancements (Enhancement[])
└── authoredComments (Comment[])

Project             — the core entity
├── owner (User)
├── updates (ProjectUpdate[])    — chronological status log
├── enhancements (Enhancement[]) — improvement backlog
├── milestones (Milestone[])     — checklist with dates
├── comments (Comment[])
└── tags (Tag[])

AuditLog            — append-only event log (not yet wired in v1)
```

Project descriptions and status updates are stored as **BlockNote JSON** in `Json` columns. That gives us:
- Native rich text without a CMS
- Future-proof structure (BlockNote is ProseMirror under the hood)
- Easy to query (descriptions don't get queried, only displayed)
- Drop-in support for any future format migration

## Auth Flow

1. User hits any `/dashboard/*` route.
2. `middleware.ts` invokes Auth.js, which validates the session JWT cookie.
3. If invalid → redirect to `/login`.
4. The `authorize` callback in `auth.ts` runs bcrypt against the user's stored hash.
5. On success, a JWT is set with `id` and `role` claims.
6. Server components read `session.user.role` to gate UI; server actions and API routes re-check on every mutation.

## RBAC

`src/lib/rbac.ts` is the single source of truth.

- `MEMBER` — sees own projects, creates own projects, edits own, comments on any project they can view.
- `MANAGER` — sees and edits all projects, manages the rollup view, cannot delete other people's projects, cannot manage users.
- `ADMIN` — everything MANAGER does plus user CRUD and any project delete.

Edit rules:
- A project owner can edit and delete their own project.
- A manager can edit any project but can't delete one that isn't theirs.
- An admin can do everything.

## Server Actions vs API Routes

- **Server actions** (`src/app/dashboard/actions.ts`) drive every form in the UI. Server-side rendered forms post directly to typed actions — no client fetch code, no client validation duplication.
- **API routes** (`src/app/api/...`) exist for external automation: scripts, webhooks, dashboards, MAX HQ pipelines. They share the same Zod schemas and the same RBAC helpers.

## Why Postgres + Prisma

Postgres is the boring default for a multi-user team app. Prisma gives us:
- Schema-as-code with migration history
- A typed client that aligns with our TypeScript code
- A studio for ad-hoc inspection

SQLite swap is documented in DEPLOY.md if you want a zero-dependency deploy for <10 users.

## Hosting

Single Linux host with:
- Docker + docker-compose
- 2 GB RAM, 1 vCPU is plenty for 50 users
- Reverse proxy (Caddy or nginx) terminates TLS and forwards to port 3000

See `docs/DEPLOY.md` for the production deploy runbook including a Caddyfile snippet and a backup cron.

## Sources

- [Plane (makeplane/plane) — Open-source PM, AGPL-3.0, Next.js + Django](https://github.com/makeplane/plane)
- [Outline self-hosting 2026 guide (BSL 1.1 → Apache 2030)](https://ossalt.com/blog/how-to-self-host-outline-notion-alternative-team-wiki-2026)
- [BlockNote GitHub repo (MPL-2.0)](https://github.com/TypeCellOS/BlockNote)
- [BlockNote vs Tiptap official comparison](https://tiptap.dev/alternatives/blocknote-vs-tiptap)
- [LogRocket: best auth library for Next.js in 2026](https://blog.logrocket.com/best-auth-library-nextjs-2026/)
- [Prisma + Better-Auth + Next.js official guide](https://www.prisma.io/docs/guides/authentication/better-auth/nextjs)

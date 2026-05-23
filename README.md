# OfficeHub

A self-hosted, Notion-like workspace for offices. Track projects, timelines, enhancements, and roll up status across the team. One Docker compose up — that's it.

Built for a single team on a single Linux server. No SaaS, no per-seat licensing, no telemetry.

## What you get

- **Projects** — title, summary, rich (BlockNote) description, status, priority, start/target dates, tags.
- **Status updates** — chronological log per project with a Notion-style block editor.
- **Enhancements** — propose, prioritize, approve, complete, reject. Tracked per project.
- **Milestones** — checklist with due dates per project.
- **Comments** — light discussion thread on each project.
- **Tags** — colored, project-spanning labels with built-in starter set (Engineering, Design, Marketing, Ops, Customer, Quick win).
- **Manager view** — single-page roll-up across every project with status / owner / overdue / keyword filters.
- **Board view** — drag-free Kanban with inline status changes (click the pill on a card to move it between columns).
- **Dashboard widgets** — your status tiles + "Due soon" (next 14 days) + recent activity feed across your projects.
- **Header search** — press `/` to focus, type to search across projects.
- **Roles** — `ADMIN` / `MANAGER` / `MEMBER`. Members see their own work; managers see everything; admins manage users.
- **Invitations** — admin creates a one-click invite link (14-day expiry). Invitee picks their own name + password. No password sharing.
- **Mobile-friendly** — sidebar collapses to a drawer on small screens.
- **Toast feedback** — every action confirms with a non-blocking toast.
- **Self-hosted** — Postgres + Next.js, ships as one Docker image with `docker compose up`.

## Stack

- Next.js 15 (App Router, server components, server actions) + TypeScript
- Postgres 16 + Prisma 5
- Auth.js v5 with credentials provider (email + password, bcrypt)
- BlockNote 0.31 (Notion-like block editor, built on ProseMirror)
- TailwindCSS + a small shadcn-style component layer
- Single Dockerfile (standalone Next output) + docker-compose

## How users sign up

There are two flows:

1. **Invitation-first (default, recommended for offices)**
   - Admin goes to `/dashboard/team` → "Invite teammate" → enter email + role → click **Create invite link**.
   - Admin copies the generated link and shares it (Slack, email, in person).
   - Recipient opens the link → fills in name + password → lands signed-in on the dashboard.
   - Links expire after 14 days. Admin can revoke any pending invite.

2. **Open self-signup (only if you flip the policy)**
   - Set `SIGNUP_POLICY=open` in `.env` and restart.
   - Anyone who knows the URL can register from `/signup` as a `MEMBER` (admin can promote later).
   - Use only for environments behind VPN / IP allowlist.

Admins can also create users directly (with a temp password) via the same Team page if needed — but invitations are the cleaner default.

## Quick start (local dev)

```bash
# 1. Install
npm install

# 2. Copy env + generate AUTH_SECRET
cp .env.example .env
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env

# 3. Start postgres (compose just the db service)
docker compose up -d db

# 4. Migrate + seed admin
npx prisma migrate dev --name init
npm run db:seed

# 5. Run
npm run dev
# → http://localhost:3000
# → sign in with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from your .env
```

## Quick start (production self-host on your server)

```bash
git clone <your-fork-url> officehub
cd officehub
cp .env.example .env
# Edit .env — change AUTH_SECRET, SEED_ADMIN_*, NEXTAUTH_URL
docker compose up -d --build
# Wait ~30s, then visit http://your-server:3000
# Run the seed once to create the first admin:
docker compose exec app npx prisma db seed
```

That's the whole deploy.

## Project structure

```
.
├── auth.ts, auth.config.ts        # Auth.js v5 root config
├── middleware.ts                  # Auth-gating middleware
├── prisma/
│   ├── schema.prisma              # Data model
│   └── seed.ts                    # First-admin bootstrap
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx   # Root + landing redirect
│   │   ├── login/, signup/        # Auth pages
│   │   ├── dashboard/             # The app
│   │   │   ├── page.tsx           # My projects
│   │   │   ├── projects/...       # Create / view / edit
│   │   │   ├── manager/page.tsx   # Manager rollup
│   │   │   ├── team/page.tsx      # Admin user mgmt
│   │   │   ├── settings/page.tsx  # Profile + password
│   │   │   └── actions.ts         # All server actions
│   │   └── api/                   # REST API (auth, projects, users, health)
│   ├── components/
│   │   ├── editor/                # BlockNote wrappers
│   │   ├── layout/                # Sidebar + Header
│   │   ├── project/               # Cards, forms, lists
│   │   └── ui/                    # Button, Input, Card, etc.
│   ├── lib/                       # db, auth helpers, rbac, validation, utils
│   └── types/                     # next-auth augmentation
├── docker-compose.yml             # Postgres + app
├── Dockerfile                     # Multi-stage standalone build
└── docs/
    ├── ARCHITECTURE.md            # Why these decisions
    ├── DEPLOY.md                  # Bare-metal, SSL, SQLite swap
    └── ROADMAP.md                 # v2 features
```

## REST API (read + write)

All endpoints require an authenticated session cookie. JSON in, JSON out, `{ data }` / `{ error }` envelope.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET    | `/api/me`                                  | any        | Current user |
| GET    | `/api/projects?scope=mine\|all&status=...` | mine: any · all: MANAGER+ | List |
| POST   | `/api/projects`                            | any        | Create |
| GET    | `/api/projects/:id`                        | owner or MANAGER+ | Detail |
| PATCH  | `/api/projects/:id`                        | owner or MANAGER+ | Update |
| DELETE | `/api/projects/:id`                        | owner or ADMIN | Delete |
| GET    | `/api/projects/:id/updates`                | owner or MANAGER+ | List status updates |
| POST   | `/api/projects/:id/updates`                | any        | Add update |
| GET    | `/api/projects/:id/enhancements`           | owner or MANAGER+ | List |
| POST   | `/api/projects/:id/enhancements`           | any        | Propose |
| GET    | `/api/projects/:id/milestones`             | owner or MANAGER+ | List |
| POST   | `/api/projects/:id/milestones`             | any        | Add |
| GET    | `/api/users`                               | MANAGER+   | List teammates |
| POST   | `/api/users`                               | ADMIN      | Create user |
| GET    | `/api/health`                              | public     | Liveness + DB check |

## Configuration

See `.env.example` for the full list. The fields you must change before production:

- `AUTH_SECRET` — `openssl rand -base64 32`
- `SEED_ADMIN_PASSWORD` — anything you can remember; the admin can change it after first sign-in
- `NEXTAUTH_URL` — the public URL the app is reachable at
- `POSTGRES_PASSWORD` — set in shell when running `docker compose` (otherwise defaults to `officehub`)
- `SIGNUP_POLICY` — `closed` (admin-only) or `open` (anyone can self-signup as MEMBER)

## Backup

The only stateful data lives in two Docker volumes:

- `officehub_db_data` — Postgres
- `officehub_uploads` — file uploads (not yet wired in v1)

Back them up with `docker run --rm -v officehub_db_data:/data -v $PWD:/backup alpine tar -czf /backup/db-$(date +%F).tgz /data`.
Restore reverses it. See `docs/DEPLOY.md` for a full backup runbook.

## License

MIT — do whatever you want with it.

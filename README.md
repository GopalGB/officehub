# OfficeHub

A self-hosted Notion + Jira hybrid for small office teams. Track projects,
tasks, timelines, and a built-in wiki — all on a single Linux server.
Postgres + Next.js. One Docker Compose up. No SaaS, no telemetry, no per-seat
fees.

**Live repo:** https://github.com/GopalGB/officehub · MIT licensed.

---

## What you get

### Project management (Jira-style)
- **Projects** — title, summary, rich (BlockNote) description, status, priority, start/target dates, tags, multi-member ownership
- **Tasks** — full backlog with status workflow (TODO → IN_PROGRESS → IN_REVIEW → DONE/BLOCKED), priority, assignee, reporter, story points, due dates, subtask hierarchy
- **Milestones** — checklist with due dates per project
- **Enhancements** — improvement proposals with status workflow
- **Status updates** — chronological log with Notion-style block editor
- **Comments** — light discussion threads on every project
- **Manager rollup** — single-page view across every project with overdue tile + filters
- **Project Kanban board** — drag-free; click status pill to move
- **Task Kanban board** — separate board for tasks (5 columns)
- **Project Timeline** — vertical aligned timeline with milestones, updates, target date, today marker

### Knowledge (Notion-style)
- **Wiki pages** — free-form BlockNote pages with nested children, emoji, autosave
- **Page tree** — sidebar tree with expand/collapse + inline "add child"
- **Page templates** — 7 starters: Meeting notes, SOP, Runbook, One-pager, 1:1, Onboarding, Blank

### Workflow polish
- **⌘K command palette** — global search + quick-jump (projects, tasks, pages, people)
- **Calendar** — month grid view, milestones + tasks color-coded by status
- **Project favorites** — star pin to top of dashboard
- **Dark mode** — toggle in header, persists, respects system pref
- **Search bar** in header — opens ⌘K palette
- **Dashboard widgets** — status tiles, "Due soon" (14 days), my open tasks, recent activity feed
- **Toast notifications** for every action
- **Color avatars** — deterministic palette from name hash
- **Subtle motion** — fade-ins, hover-lift cards (respects `prefers-reduced-motion`)
- **Mobile-friendly** — sidebar collapses to drawer below 768px

### Accounts
- **3 roles**: ADMIN / MANAGER / MEMBER
- **Two ways to add teammates**:
  - **Invite link** — generates a 14-day URL, recipient sets their own password
  - **Direct password** — admin sets it inline (auto-generates memorable
    suggestions like `Mango482!`), stored bcrypt-hashed in your Postgres
- **Closed signup by default** — flip to `SIGNUP_POLICY=open` for public self-signup

### Infrastructure
- **One docker-compose up** — Postgres + Next.js standalone
- **REST API** for external automation (see [`docs/API.md`](docs/API.md))
- **Health endpoint** at `/api/health` for monitoring
- **Pre-push secret-scan hook** installed (blocks accidental `.env` pushes)

---

## Stack

- Next.js 15.1.6 (App Router, React Server Components, Server Actions)
- TypeScript (strict mode)
- Postgres 16 + Prisma 5
- Auth.js v5 with credentials provider, bcrypt
- BlockNote 0.31 (Notion-like block editor on ProseMirror)
- TailwindCSS 3 with shadcn-style component layer
- Docker + Docker Compose
- ~28 routes, ~106KB shared JS

---

## Install — three ways

Pick whichever fits your machine. All three end with a working OfficeHub at `http://localhost:3000` and admin credentials printed to your terminal.

### 1. Native install — macOS / Linux (no Docker needed)

Requires Node 20+, git, and PostgreSQL. The script installs Postgres for you on macOS via Homebrew; on Linux it asks you to install via your package manager first (one apt/dnf/pacman command — instructions printed).

```bash
curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.sh | bash
```

Then:
```bash
cd ~/officehub
npm run dev
```

### 2. Native install — Windows (no Docker, no WSL)

Requires Node 20+, git, and PostgreSQL. Install missing pieces via `winget` (instructions printed by the script).

Open **PowerShell** (NOT cmd) and run:
```powershell
irm https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.ps1 | iex
```

Then:
```powershell
cd $HOME\officehub
npm run dev
```

### 3. Docker install (everything bundled — recommended for servers)

If you have Docker installed, this is the simplest path because Postgres comes with it. No language/runtime requirements beyond Docker itself.

```bash
curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup.sh | bash
```

That's the whole install. Container runs in the background; no `npm run dev` needed.

---

## Install on your office server

```bash
# On the server (Ubuntu 22.04+ / Debian 12+, Docker + docker compose, 2 GB RAM)
git clone https://github.com/GopalGB/officehub.git /opt/officehub
cd /opt/officehub

cp .env.example .env

# Generate the auth secret
sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env

# Set your public URL
sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"https://office.yourcompany.com\"|" .env

# Set a strong DB password (docker-compose reads $POSTGRES_PASSWORD from your shell)
export POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"

# Build + start
docker compose up -d --build

# Wait ~30s for db to be healthy, then seed first admin
docker compose exec app npx prisma db seed
```

App is live on `:3000`. Initial admin credentials come from `SEED_ADMIN_*`
env vars (defaults shown in `.env.example`). Change them before first deploy.

**For HTTPS via Caddy or nginx**, full Caddyfile + nginx snippets in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Local development

```bash
git clone https://github.com/GopalGB/officehub.git
cd officehub
cp .env.example .env
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env

docker-compose up -d db        # start just Postgres
npm install
npx prisma db push             # apply schema (no migrations needed for dev)
npm run db:seed                # admin + starter tags
npm run dev                    # http://localhost:3000
```

Default login: `admin@office.local` / `Office2026!Admin`.

---

## How users join

Two paths, both built in. Admin chooses per situation on `/dashboard/team`:

1. **Invite link** (recommended for remote teammates):
   - Admin → Team → "Add teammate" → Invite link tab
   - Enter email + role → click "Create invite link"
   - Copy the generated URL and send via Slack/email
   - Recipient opens link, sets their own name + password, lands signed in
   - Links auto-expire after 14 days
2. **Direct password** (recommended for in-person onboarding):
   - Admin → Team → "Add teammate" → Set password tab
   - Enter name + email; the form auto-suggests a memorable password (regen button)
   - Click "Create account" — done; share credentials with the user
   - User can change password from `/dashboard/settings` later

Passwords are bcrypt-hashed (cost 12) and stored only in your Postgres.

---

## Docs index

| Doc | Purpose |
|---|---|
| [README.md](README.md) | You are here |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Why these tech decisions, data model |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production deployment runbook (Caddy/nginx/backup/restore) |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's next (v1.1+) |
| [AGENTS.md](AGENTS.md) | Guide for AI coding agents (Codex/Cursor/Claude) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to send a PR |

---

## Project structure

```
.
├── prisma/schema.prisma        # data model
├── auth.ts, auth.config.ts     # Auth.js v5 config
├── middleware.ts               # route protection
├── docker-compose.yml          # Postgres + app
├── Dockerfile                  # multi-stage standalone build
└── src/
    ├── app/
    │   ├── login/, signup/, invite/[token]/
    │   ├── dashboard/
    │   │   ├── page.tsx            # dashboard home (favorites, tiles, widgets)
    │   │   ├── projects/[id]/      # project detail + edit
    │   │   ├── tasks/, tasks/board/
    │   │   ├── board/              # project Kanban
    │   │   ├── calendar/
    │   │   ├── pages/, pages/[id]/ # wiki
    │   │   ├── manager/, team/, settings/
    │   │   └── actions.ts          # ALL server actions
    │   └── api/                    # REST: me, projects, users, search, health
    └── components/, lib/, types/
```

---

## REST API quick example

```bash
# List your projects (using browser session cookie)
curl -s -H "Cookie: next-auth.session-token=<token>" \
  http://localhost:3000/api/projects?scope=mine

# Search across everything
curl -s -H "Cookie: next-auth.session-token=<token>" \
  "http://localhost:3000/api/search?q=launch"

# Health (public)
curl -s http://localhost:3000/api/health
```

Full reference: [`docs/API.md`](docs/API.md).

---

## Integrating with AI coding agents (Codex / Cursor / Claude Code)

This repo ships an [`AGENTS.md`](AGENTS.md) at the root — the
[community standard](https://agents.md) recognized by OpenAI Codex, Cursor,
Aider, Claude Code, and most other AI coding tools.

```bash
# Clone, then point your agent at it:

# OpenAI Codex CLI
codex review                     # independent diff review
codex challenge                  # adversarial: try to break the code
codex consult "How do I add..."  # ask a question, get a code-aware answer

# Cursor / Claude Code: just open the repo. Both auto-load AGENTS.md.

# Aider
aider --read AGENTS.md src/app/dashboard/actions.ts
```

`AGENTS.md` covers:
- Stack overview and directory layout
- "How to add a new entity end-to-end" recipe
- All conventions (RBAC, server actions, BlockNote SSR guard, etc.)
- Things to avoid
- Code review checklist

If you're building an integration on top of OfficeHub via its REST API,
start with [`docs/API.md`](docs/API.md).

---

## Backup

Two Docker volumes hold all state:
- `officehub_db_data` — Postgres data
- `officehub_uploads` — file uploads (not yet wired, planned)

Daily backup cron (from `docs/DEPLOY.md`):
```bash
docker exec officehub-db pg_dump -U officehub officehub | gzip \
  > /var/backups/officehub/officehub-$(date +%F).sql.gz
```

Restore reverses it. Test the restore path quarterly — an untested backup
is not a backup.

---

## Configuration

See `.env.example` for the full list. Critical fields to change:

| Var | Purpose |
|---|---|
| `AUTH_SECRET` | Session signing key — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of the deployment |
| `DATABASE_URL` | Postgres connection string (compose handles this) |
| `POSTGRES_PASSWORD` | Set in shell when running compose |
| `SEED_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` | First admin credentials |
| `SIGNUP_POLICY` | `closed` (default — invite-only) or `open` |

---

## What's intentionally NOT in v1

- File attachments (schema ready, upload pipeline pending — [docs/ROADMAP.md](docs/ROADMAP.md))
- Email notifications / digests
- SSO (OIDC/SAML)
- Real-time collaborative editing
- Mobile native apps
- Multi-workspace / multi-tenant

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the full backlog.

---

## License

MIT. Do whatever you want with it. Issues + PRs welcome — see
[`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Acknowledgements

Built on the shoulders of: **Next.js** (Vercel), **Prisma** (Prisma team),
**BlockNote** (TypeCellOS), **Auth.js**, **TailwindCSS**, **shadcn/ui**,
**Lucide icons**, and the **Postgres** community.

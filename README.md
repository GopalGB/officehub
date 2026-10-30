# OfficeHub

A self-hosted Notion + Jira hybrid for small office teams. Track projects,
reports, enhancements, weekly focus, fiscal deadlines, and a built-in wiki on a Windows or Linux server.
Postgres + Next.js. Native Windows user-account deployment or Docker. No SaaS, no telemetry, no per-seat
fees.

**Live repo:** https://github.com/GopalGB/officehub · MIT licensed.

---

## What you get

### Project tracking
- **Projects** — owner and sub-owner, source-project lineage, deadlines, rich notes, success criteria, estimates, and expected time savings
- **Project journey** — visual original-delivery and enhancement timeline, independent release dates, and milestone markers
- **Reports** — deliverables with notes, HTTP(S) document links, owners, estimates, status, due dates, and a board; existing task data is preserved
- **My week** — recurring weekdays within a weekly plan, daily overrides, skip/reset, overlap checks, and planning history
- **Team overview** — management sees who is working on what, date-specific focus, weekly capacity, projects, and reports
- **Request pool** — expiring shareable intake forms, saved requests, management review, and transactional owner assignment
- **Version history** — immutable project detail versions, restore as a new version, and before/after audits for project work
- **Fiscal calendar** — supplied company FY2026–2028 calendars, original PDFs, 4-5-4 periods, fiscal weeks, quarters, and configurable alignment for other years
- **Archive** — keep completed work and its history available

Read the [workspace guide](docs/PROJECT-WORKSPACE.md) for permissions, daily planning, version boundaries, and request-link behavior.

### Knowledge (Notion-style)
- **Wiki pages** — free-form BlockNote pages with nested children, emoji, autosave
- **Page tree** — sidebar tree with expand/collapse + inline "add child"
- **Page templates** — 7 starters: Meeting notes, SOP, Runbook, One-pager, 1:1, Onboarding, Blank

### Workflow polish
- **⌘K command palette** — global search + quick-jump (projects, reports, pages, people)
- **Fiscal calendar** — project, report, milestone, and enhancement deadlines
- **Project favorites** — star pin to top of dashboard
- **Search bar** in header — opens ⌘K palette
- **Dashboard widgets** — status tiles, "Due soon" (14 days), my open reports, recent activity feed
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

- Next.js 15.5.28 (App Router, React Server Components, Server Actions)
- TypeScript (strict mode)
- Postgres 16 + Prisma 5
- Auth.js v5 with credentials provider, bcrypt
- BlockNote 0.56 (Notion-like block editor on ProseMirror)
- TailwindCSS 3 with shadcn-style component layer
- Docker + Docker Compose

---

## Install — three ways

Pick the deployment that fits your machine. Existing Windows installations keep their database and login credentials; use port 8599 and the Windows update guide below.

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

### 2. Native Windows — normal user, no Docker

Use existing company-approved Git, Node.js, and PostgreSQL. The Windows updater backs up the database, preserves `.env` and root `logo.png`, pulls `main`, installs dependencies, applies additive schema changes, builds, and starts on port 8599. It does not change execution policy, firewall rules, services, system PATH, or database server settings.

Follow the [Windows deployment and update guide](docs/WINDOWS.md). For an existing installation, stop the old app with Ctrl+C and use the update block in that guide. Keep the new terminal open.

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
| [BUILD.md](BUILD.md) | Build / run / test / lint / deploy — pure commands reference |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Why these tech decisions, data model |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production deployment runbook (Caddy/nginx/backup/restore) |
| [docs/EXTENDING.md](docs/EXTENDING.md) | 8 recipes for common extensions |
| [docs/GSD-PLAYBOOK.md](docs/GSD-PLAYBOOK.md) | 7-phase build methodology |
| [docs/B2B-DEPLOYMENT.md](docs/B2B-DEPLOYMENT.md) | Multi-tenant, SSO, white-label, compliance |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/SKILLS-CATALOG.md](docs/SKILLS-CATALOG.md) | AI-agent skills tiered Tier 1→5 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's next (v1.1+) |
| [AGENTS.md](AGENTS.md) | Universal AI-agent rules (Codex/Cursor/Claude all auto-load) |
| [CLAUDE.md](CLAUDE.md) | Claude Code project rules |
| [CODEX.md](CODEX.md) | OpenAI Codex CLI commands + recipes |
| [CODEX-PLAYBOOK.md](CODEX-PLAYBOOK.md) | "Codex, adapt this for my company" brief |
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

## Want Codex to adapt this for your company?

Paste the link to this repo and **[CODEX-PLAYBOOK.md](CODEX-PLAYBOOK.md)** into a fresh Codex session, then say:

```
Read AGENTS.md and CODEX-PLAYBOOK.md from this repo. I want to adapt
OfficeHub for <my company>. Ask me the 6 questions, then propose the
brand + feature flag PR.
```

Codex follows the playbook end-to-end: detects your OS, picks the right install command, asks the 6 questions, makes a clean branded PR, and walks you through deploying when ready.

The same playbook works for Cursor, Claude Code, and Aider (all auto-load `AGENTS.md` + `CODEX-PLAYBOOK.md` from the repo root).

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

### Catalyst Brands logo and theme

The workspace uses Catalyst Brands' navy, orange, blue, and white styling.
Add your logo as **`logo.png` at the repository root**; it appears in the sidebar,
mobile menu, and account screens. A text fallback fills the slot until the file
exists. Add the file before building Docker images, or mount it at `/app/logo.png`.
See [the branding guide](docs/BRANDING.md) for dimensions, Docker mounting, and theme tokens.

Projects has a **Cards / Board** switch and a manager **Import Excel** button.
Inside a project, **Overview** shows stage progress and the project team;
**Work** contains reports, enhancements, milestones, and discussion; **History**
contains recorded changes and versions. Expand **Project details** for imported
columns, notes, effort, and team information, or **View dated timeline** for the
schedule. Optional fields in create/edit forms stay under **More project details**.
Existing project-section links continue to work.

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

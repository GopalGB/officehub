# BUILD.md — Build, run, test, lint, deploy

> Pure commands reference. No prose. For why-decisions see `docs/ARCHITECTURE.md`; for full deploy runbook see `docs/DEPLOY.md`.

---

## Prerequisites

| Tool | Min version | Verify |
|---|---|---|
| Node.js | 20.x | `node --version` |
| npm | 10.x | `npm --version` |
| git | 2.30+ | `git --version` |
| PostgreSQL | 14+ | `psql --version` (only if running native, not via Docker) |
| Docker (optional) | 24+ | `docker --version` |
| Docker Compose plugin (optional) | 2.20+ | `docker compose version` |

---

## Bootstrap

### Option A — Docker (recommended for production)
```bash
git clone https://github.com/GopalGB/officehub.git
cd officehub
cp .env.example .env
# Edit .env: AUTH_SECRET, NEXTAUTH_URL, POSTGRES_PASSWORD, SEED_ADMIN_*
docker compose up -d --build
docker compose exec app npx prisma db seed
# → http://localhost:3000
```

### Option B — Native (no Docker)

**Mac / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.sh | bash
cd ~/officehub && npm run dev
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.ps1 | iex
cd $HOME\officehub
npm run dev
```

### Option C — Manual (full control)
```bash
git clone https://github.com/GopalGB/officehub.git
cd officehub
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL + AUTH_SECRET + SEED_ADMIN_*
npx prisma generate
npx prisma db push       # dev
# OR for prod: npx prisma migrate deploy
npm run db:seed
npm run dev              # dev mode (HMR)
# OR for prod:
npm run build && npm start
```

---

## Daily commands

```bash
npm run dev                 # development server, HMR, port 3000
npm run build               # production build (runs prisma generate first)
npm start                   # serve the production build
npm run lint                # Next.js ESLint (passes through to eslint.config.mjs if installed)
npm run db:push             # apply schema (dev)
npm run db:migrate          # create + apply migration (prod-bound)
npm run db:migrate:deploy   # apply migrations only (CI/CD)
npm run db:seed             # seed admin + starter tags
npm run db:studio           # open Prisma Studio at http://localhost:5555
```

---

## Quality gates (run before every commit)

```bash
# Strict typecheck — MUST be zero warnings
npx tsc --noEmit --noUnusedLocals --noUnusedParameters

# Production build — MUST succeed
npm run build

# (Optional, when eslint deps land)
npm run lint -- --max-warnings=0
```

CI runs these on every push and PR (`.github/workflows/ci.yml`).

---

## Database

### Reset (dev only — destroys all data)
```bash
# Docker
docker compose down -v && docker compose up -d db
npx prisma db push && npm run db:seed

# Native
psql -d postgres -c "DROP DATABASE officehub;"
psql -d postgres -c "CREATE DATABASE officehub OWNER officehub;"
npx prisma db push && npm run db:seed
```

### Backup (prod)
```bash
# Docker
docker exec officehub-db pg_dump -U officehub officehub | gzip > backup-$(date +%F).sql.gz

# Native
pg_dump -U officehub officehub | gzip > backup-$(date +%F).sql.gz
```

### Restore
```bash
# Docker
gunzip -c backup-2026-05-27.sql.gz | docker exec -i officehub-db psql -U officehub -d officehub

# Native
gunzip -c backup-2026-05-27.sql.gz | psql -U officehub -d officehub
```

---

## Testing

> No test harness yet (planned in roadmap). Manual verification flow:

```bash
# 1. Build must succeed
npm run build

# 2. Health endpoint
curl -s http://localhost:3000/api/health
# Expected: {"status":"ok","db":"ok",...}

# 3. Auth flow (browser)
# - Open http://localhost:3000/login
# - Sign in with SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD from .env
# - Should land on /dashboard
# - Sign out, try wrong password → "Wrong email or password"

# 4. RBAC matrix (per role, click through):
# - ADMIN: sees Team page, can create users
# - MANAGER: sees Manager view + all projects, no Team page
# - MEMBER: sees own projects + projects they're a member of, no Manager/Team
```

When Vitest + Playwright land:
```bash
npm test                     # Vitest unit + integration
npm run test:e2e             # Playwright end-to-end
npm run test:coverage        # coverage report
```

---

## Deployment

### Self-host on a VPS (recommended)
```bash
ssh user@your-server
git clone https://github.com/GopalGB/officehub.git /opt/officehub
cd /opt/officehub
cp .env.example .env
# Edit production values — AUTH_SECRET, NEXTAUTH_URL=https://office.yourdomain.com, etc.
docker compose up -d --build
docker compose exec app npx prisma db seed
```

Put Caddy in front for HTTPS (snippet in `docs/DEPLOY.md`).

### Coolify / Dokploy / Easypanel
Point the platform at the GitHub repo. It reads `docker-compose.yml` automatically. Set `AUTH_SECRET` + `POSTGRES_PASSWORD` + `NEXTAUTH_URL` in the platform's env-var UI.

### Railway
Click "New Project from GitHub" → pick this repo → add a Postgres service → set env vars. ~3 minutes.

### NOT supported (Vercel, Netlify serverless)
The app uses long-lived server actions + a persistent Postgres connection pool. Serverless adds cold-start latency and breaks Prisma's connection management. Use a VM/container host.

---

## Update an existing deploy

```bash
cd /opt/officehub
git pull
docker compose up -d --build
# Prisma migrations apply automatically at container start (Dockerfile entrypoint)

# If you swap to manual migrations:
docker compose exec app npx prisma migrate deploy
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker: command not found` | Install Docker Desktop or Colima (Mac) / engine (Linux) |
| `Cannot connect to the Docker daemon` | Start Docker Desktop OR `colima start` |
| `Can't reach database server at localhost:5432` | DB container down — `docker compose up -d db` |
| `Error: P1001: Can't reach database server` (native) | Postgres not running — `brew services start postgresql@16` / `sudo systemctl start postgresql` |
| `Hydration mismatch` | Hard refresh (Cmd+Shift+R). If persists, `rm -rf .next` + restart dev |
| `Cannot find module './chunks/XXX.js'` | Stale `.next` — kill dev, `rm -rf .next`, restart |
| First click after restart takes 30+ seconds | Dev compile latency. Pre-warm: `curl http://localhost:3000/login` |
| Build fails with `PageNotFoundError /_document` | A dev server is still touching `.next`. Kill all `next` processes, `rm -rf .next`, build |
| Login button does nothing | Pre-warm + hard refresh. See `docs/DEPLOY.md` Troubleshooting |

---

## Versioning

This repo uses Conventional Commits (`feat:`, `fix:`, `docs:`, etc.) — see `methodology/INDEX.md`. Version tags follow semver. Releases are created from `main` after a green CI run.

```bash
git tag v2.1.0
git push origin v2.1.0
# GitHub Releases auto-create from tags
```

---

## File map (where things live)

```
.env.example                     # env vars template
docker-compose.yml               # Postgres + app
Dockerfile                       # multi-stage standalone build
auth.ts, auth.config.ts          # Auth.js v5 wiring
middleware.ts                    # route protection + auth gate
next.config.ts                   # Next.js config (eslint.ignoreDuringBuilds: true)
tailwind.config.ts               # Tailwind (darkMode: ["class"] — dead code, no `.dark` ever set)
postcss.config.mjs               # PostCSS — autoprefixer + tailwind
eslint.config.mjs                # ESLint 9 flat config (deps not yet in package.json)
prisma/
  schema.prisma                  # data model — source of truth
  seed.ts                        # bootstrap admin + tags
scripts/
  setup.sh                       # one-command Docker install
  setup-native.sh                # Mac/Linux native install (no Docker)
  setup-native.ps1               # Windows native install (no Docker)
src/
  app/                           # Next.js App Router pages + API
    layout.tsx, page.tsx
    login/, signup/, invite/[token]/
    dashboard/
      layout.tsx, page.tsx
      actions.ts                 # ALL server actions
      projects/, tasks/, pages/, calendar/, board/, manager/, team/, settings/
    api/                         # REST endpoints
  components/                    # React components
    ui/, layout/, editor/, project/, task/, pages/, team/, dashboard/, sprint/
  lib/                           # framework code (no React)
    db.ts                        # Prisma singleton
    rbac.ts                      # canEditProject, canDeleteProject, isAdmin, etc.
    validation.ts                # Zod schemas — one per entity
    api.ts                       # REST helpers
    utils.ts                     # cn(), formatDate(), timeAgo(), initials()
    colors.ts                    # deterministic name → palette
    invitations.ts               # token generator + URL builder
    pageTemplates.ts             # Notion page starter templates
  types/
    next-auth.d.ts               # session augmentation (role)
config/
  features.ts                    # feature flag registry
plugins/                         # plugin convention scaffolding (runtime in v2.1)
methodology/
  INDEX.md
  recipes/add-entity.md          # canonical "add an entity" walkthrough
docs/                            # deep docs
  ARCHITECTURE.md, DEPLOY.md, API.md, ROADMAP.md
  GSD-PLAYBOOK.md                # 7-phase methodology
  EXTENDING.md                   # 8 recipes
  B2B-DEPLOYMENT.md              # multi-tenant + SSO + white-label
  SKILLS-CATALOG.md              # AI agent skills
AGENTS.md                        # agent rules (universal — Codex/Cursor/etc auto-load)
CLAUDE.md                        # Claude Code rules
CODEX.md                         # OpenAI Codex CLI usage
CODEX-PLAYBOOK.md                # "Codex, adapt this for my company" brief
BUILD.md                         # ← you are here
CONTRIBUTING.md                  # PR workflow
README.md                        # user-facing entry point
.cursorrules                     # Cursor (legacy)
.cursor/rules/main.mdc           # Cursor (2026 format)
.windsurfrules                   # Windsurf
.codex/config.json               # Codex CLI sample config
.github/workflows/ci.yml         # GitHub Actions CI
```

---

## TL;DR

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.sh | bash

# Daily
cd ~/officehub && npm run dev

# Before commit
npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm run build

# Update
git pull && npm install && npx prisma db push && npm run dev
```

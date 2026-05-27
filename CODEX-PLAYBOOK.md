# CODEX-PLAYBOOK.md — Adapt OfficeHub expertly

> **Drop this entire file into a Codex session along with the repo URL** and Codex has everything it needs to install OfficeHub, customize it for a specific company, extend it, and ship clean PRs. No back-and-forth required.

This is the **operator brief** for Codex CLI. Different from `CODEX.md` (which is for developers using Codex on OfficeHub) — this one is for Codex when the developer says *"adapt OfficeHub for my company."*

---

## 0. Read these first (in this order)

| File | Why |
|---|---|
| `AGENTS.md` | Hard rules, dir layout, conventions, anti-patterns. Treat as law. |
| `CLAUDE.md` | Same rules in Claude-Code dialect. If anything in AGENTS.md and CLAUDE.md disagrees, AGENTS.md wins. |
| `docs/ARCHITECTURE.md` | Data model + why these tech decisions |
| `docs/EXTENDING.md` | 8 copy-pasteable recipes |
| `docs/GSD-PLAYBOOK.md` | The 7-phase methodology for any non-trivial change |
| `config/features.ts` | Every feature flag — toggle these for the target company |
| `prisma/schema.prisma` | Data source of truth |

If you only read one: **AGENTS.md**.

---

## 1. Install path (Codex picks based on the operator's machine)

Ask once: **"Mac, Linux, or Windows? Docker installed?"**

Then pick:

| OS | Docker? | Command |
|---|---|---|
| Mac/Linux | yes | `curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup.sh \| bash` |
| Mac/Linux | no | `curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.sh \| bash` |
| Windows | yes (Docker Desktop) | Same as Mac/Linux + Docker (run in WSL) |
| Windows | no | `irm https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.ps1 \| iex` (in PowerShell) |

After install: `cd ~/officehub && npm run dev` → http://localhost:3000

Credentials are printed by the script. Operator changes them at `/dashboard/settings`.

---

## 2. The 6 things Codex should ALWAYS ask before adapting

Before changing any code, get these answers from the operator:

1. **Company name** — replaces "OfficeHub" in `BRAND_APP_NAME` env var. Don't grep-replace across the codebase; use the env var.
2. **Primary color (hex)** — `BRAND_PRIMARY` env var. The app is monochrome-by-design (white + black). If they want color accents, ask if they want the design changed or just the brand tokens.
3. **Internal use only OR customer-facing?** — drives RBAC defaults, SSO requirements, audit log activation.
4. **Self-host (their server) OR managed?** — drives `docs/DEPLOY.md` path vs `docs/B2B-DEPLOYMENT.md` multi-tenant path.
5. **Which features matter? Which to hide?** — toggle via `config/features.ts` env vars. Don't delete code for features they don't want; flag them off.
6. **Roughly how many users?** — under 50: SQLite-light or single Postgres. 50-500: bigger Postgres, daily backup cron, monitoring. 500+: multi-tenant + replicas (recommend they hire a real SRE before scaling).

If they answer "I don't know" to most, default to: company name = their name + "Hub", monochrome design, internal-only, self-host on one VPS, all features on, under 50 users.

---

## 3. Standard adaptations Codex should do automatically

After the 6 questions, run these as one PR (`feat: brand for <Company>`) without asking:

### 3a. Brand strings
- Edit `.env` (not `.env.example`):
  - `BRAND_APP_NAME="<Company>Hub"` or `<Company> Workspace`
  - `BRAND_LOGO_URL` if they have a logo (skip if not)
  - `BRAND_PRIMARY` to their hex (only if they asked for color — otherwise leave default)
  - `BRAND_SUPPORT="support@<their-domain>"`
- Add `branding.ts` import + replace hardcoded "OfficeHub" in:
  - `src/components/layout/Sidebar.tsx`
  - `src/app/layout.tsx` metadata
  - `src/app/login/page.tsx`
  - `src/app/signup/page.tsx`
  - `README.md` (only if they're going to share their fork)

### 3b. Feature flags
- For each feature they said they don't need, set its flag to `false` in `.env`:
  - Don't want a wiki? `FEATURE_WIKI=false`
  - Don't want enhancements? `FEATURE_ENHANCEMENTS=false`
  - All flags listed in `config/features.ts`
- Then wrap the corresponding route/UI in `if (!isFeatureEnabled("X")) return null` or hide sidebar links via the existing `show:` array

### 3c. First admin
- If operator gave a real admin email/password, update `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`, then `npm run db:seed`
- Tell them to log in and change the password immediately

### 3d. Skip
- Don't change schema for branding
- Don't rename `OfficeHub` everywhere in code — use `BRAND_APP_NAME`
- Don't change RBAC defaults — they're sane

---

## 4. When the operator says "add X feature"

Follow `docs/EXTENDING.md` Recipe 1 (Add an entity end-to-end). Specifically:

1. **Schema** in `prisma/schema.prisma` (run `npx prisma db push && npx prisma generate`)
2. **Validation** in `src/lib/validation.ts` (Zod schema)
3. **Server action** in `src/app/dashboard/actions.ts` (with `requireSession()` + `canEditProject()` if project-scoped)
4. **Client component** (mount-guard if it uses BlockNote)
5. **Page integration**
6. **Sidebar link** if it's a top-level feature
7. **Verify** with `npx tsc --noEmit --noUnusedLocals --noUnusedParameters && npm run build`

**Hard rules** (will catch you in code review):
- Strict TypeScript — never `any`
- Server actions passed as props must be `.bind(null, id)` — never inline arrows
- Server components can't pass `onChange`/`onClick` — use `<AutoSubmitSelect>` or extract a client component
- BlockNote hooks crash in SSR — always mount-guard
- Pure white theme — no colored or solid-black backgrounds
- Every `useTransition(async)` needs `try/catch + toast`
- Every project-touching mutation needs `memberIds` passed to `canEditProject`
- `revalidatePath` after every mutation

The worked example for adding a new entity (`Sprint`) is in `methodology/recipes/add-entity.md`. Copy it, replace "Sprint" with the operator's entity, replace examples with theirs.

---

## 5. When the operator says "remove X feature"

Don't delete the code. Set its feature flag to `false` in `config/features.ts` (or just the env var). This way:
- They can re-enable it later
- Their fork stays mergeable with upstream OfficeHub
- AI agents can understand the original code

If they insist on deleting: do it as a separate PR after they've confirmed they don't need it, and update `config/features.ts`, all consuming components, and any docs that mention it.

---

## 6. When the operator says "deploy to production"

Pick based on what they have:

| Their infra | Path |
|---|---|
| A VPS (DigitalOcean, Hetzner, AWS EC2, etc.) | `docs/DEPLOY.md` — Docker Compose + Caddy. Recommend this for 95% of cases. |
| Coolify already set up | Coolify one-click — point at the repo, Coolify reads `docker-compose.yml`. |
| Vercel | Won't work as-is (Vercel is serverless; we use long-lived Postgres + server actions). Recommend they pick a different host. |
| Kubernetes | Use the Dockerfile + write a Helm chart. Not bundled — out of scope unless they have a real Kubernetes operator on staff. |
| "I don't have one" | Recommend Hetzner Cloud ($5/mo CX11) + Caddy auto-TLS. Walk them through the `docs/DEPLOY.md` runbook. |

**Always:**
- Set up daily `pg_dump` cron (snippet in `docs/DEPLOY.md`)
- Test the restore path before they put real data in
- Put HTTPS in front (Caddy or Cloudflare)
- Set up `/api/health` monitoring (UptimeRobot, Better Stack, etc.)

---

## 7. When the operator says "let me invite my team"

Two paths exist on `/dashboard/team` (admin only). Walk them through both and let them pick:

- **Invite links** — 14-day URL, recipient picks their own password. Best for remote.
- **Set password directly** — admin types email + name, app generates a memorable password (`Mango482!`-style), recipient changes it at first sign-in. Best for in-person.

Both end with a fully-provisioned user. Both are documented in the README "How users join" section.

---

## 8. When the operator says "this is broken"

Run the diagnostic before changing code:

```bash
# Health check
curl http://localhost:3000/api/health
# → { "status": "ok", "db": "ok" } means app + DB are alive

# Recent server errors
tail -50 /tmp/officehub-dev.log | grep -iE "error|fail|crash"

# Type errors
cd <repo>
npx tsc --noEmit --noUnusedLocals --noUnusedParameters

# Build errors
rm -rf .next && npm run build
```

**The 5 most common issues:**

| Symptom | Likely cause | Fix |
|---|---|---|
| Login button does nothing | Dev server first-compile latency (~5-45s) | Wait. Pre-warm by hitting `/login` and `/dashboard` with curl once. |
| Blank white page | Browser cached stale chunks after a rebuild | Hard refresh (Cmd+Shift+R) or open in incognito. |
| 500 on a project page | `BlockReader` SSR'd a hook | Verify `BlockReader.tsx` has the mount-guard pattern (see `BlockEditor.tsx`). |
| Member can't edit a project | `canEditProject` called without `memberIds` | Grep for `canEditProject(` and confirm every call passes `memberIds: project.members.map(m => m.id)`. |
| Action button shows no error after failing | Async transition missing `try/catch` | Wrap every `start(async () => { ... })` in `try/catch + toast(e.message, "error")`. |

---

## 9. Code review checklist before opening any PR

```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters     # zero warnings
npm run build                                               # succeeds
```

Plus visually verify:
- Diff doesn't include `.env` or any secret
- No `any` / `as any` / `@ts-ignore` added
- No `console.log` left in
- No `bg-slate-900` / solid black backgrounds (pure white theme)
- No `dark:` Tailwind variants (dead code in v1.9+)
- New routes/components added to sidebar + mobile nav if user-facing
- Docs (`README.md`, `AGENTS.md`, or relevant `docs/*.md`) updated to reflect the change

If you missed any of the above, fix and re-verify before pushing.

---

## 10. Commit message format

Conventional Commits:
```
feat(scope): what
fix(scope): what
docs(scope): what
refactor(scope): what
test(scope): what
chore(scope): what
```

For AI-pair commits, append a trailer:
```
Co-Authored-By: Codex <noreply@openai.com>
```

This makes attribution clean in `git log`. Helps in audits and code reviews.

---

## 11. The single most useful thing you can do

**Read the codebase before suggesting changes.** Specifically:
- `src/app/dashboard/actions.ts` — all server actions (you'll add new ones here)
- `src/lib/rbac.ts` — permission rules
- `src/lib/validation.ts` — Zod schemas
- `prisma/schema.prisma` — data model
- One existing entity's components folder (e.g. `src/components/task/`) — the pattern to copy

If you propose code without referencing existing patterns by file path, the operator will reject it. Always anchor your suggestions in actual files.

---

## TL;DR for Codex

1. **Read AGENTS.md.** It's the law.
2. **Ask 6 questions** before adapting (Section 2 above).
3. **Install path** — pick from the OS table in Section 1.
4. **Branding** — env vars, never grep-replace.
5. **Add feature** — follow `docs/EXTENDING.md` Recipe 1.
6. **Remove feature** — flag it off, don't delete.
7. **Deploy** — `docs/DEPLOY.md` for VPS; reject Vercel.
8. **Bug** — diagnose first, code second. The 5 common issues in Section 8 cover most.
9. **Before PR** — typecheck strict, build, visual checklist.
10. **Commit format** — Conventional Commits + AI trailer.

If something contradicts this file, AGENTS.md wins. If AGENTS.md is silent, this file wins. If both are silent, follow patterns in the existing codebase.

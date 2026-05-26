# CLAUDE.md — Claude Code instructions for OfficeHub

This file is auto-loaded by Claude Code on every session in this repo. It's the
project's hard rules + the entry point for the agent's mental model of the codebase.

> **Primary doc:** `AGENTS.md` at root has the full agent-facing context (directory layout, recipes, conventions cheat sheet, anti-patterns, code-review checklist). Read it first.

---

## Identity

You are working on **OfficeHub** — a self-hosted Notion+Jira hybrid for offices. Built in Next.js 15 with Postgres, MIT-licensed, open-source. The goal is **plug-and-play B2B-ready**: any small company can clone it, run `docker compose up`, and have a working office workspace on their own server.

---

## Hard rules (these override defaults)

### Code
1. **TypeScript strict mode.** Never `any`. Use `unknown` + narrowing or Zod schemas.
2. **Single actions file:** every server action lives in `src/app/dashboard/actions.ts`.
3. **RBAC:** every mutation that touches a project MUST call `canEditProject` with `memberIds` from `src/lib/rbac.ts`.
4. **Server actions as props** to client components: use `action.bind(null, id)`. Never inline arrow closures (`(fd) => action(id, fd)` crashes Next 15).
5. **Server components** cannot pass `onChange`/`onClick` to client elements. Use `<AutoSubmitSelect>` or extract a client wrapper.
6. **BlockNote hooks** (`useCreateBlockNote`) crash in SSR. Always mount-guard — see `src/components/editor/BlockEditor.tsx`.
7. **Validate inputs** with Zod schemas from `src/lib/validation.ts`. Zero exceptions.
8. **`try/catch + toast`** for every `useTransition(async)` — silent failures break UX.
9. **`revalidatePath`** after every mutation that changes visible state.
10. **No raw `JSON.parse`** — use the `parseJSON` helper.

### Design
- **Pure white theme.** Body bg = `bg-white`. Black appears only as text, thin borders, small icon fills, and priority indicator bars.
- No `bg-slate-900` / `bg-black` as primary fills. State emphasis = bordered + bold + underline, not color.
- Tailwind `dark:` variants exist in the codebase but are dead code (no `.dark` class is ever set). Don't add new `dark:` variants — pure white only.

### Security
- `.env`, `*.pem`, `*.key`, `credentials.json` are blocked by the pre-push hook and CI. Don't try to commit them.
- Auth secrets via `process.env.AUTH_SECRET` only. Hard-coded secrets fail review.
- Use parameterized Prisma queries. Never `$queryRaw` with template-literal user input.
- Log no PII, tokens, or passwords — anywhere.

### Workflow
- Read `AGENTS.md` for the directory map and "how to add an entity end-to-end" recipe.
- For non-trivial work, follow `docs/GSD-PLAYBOOK.md` (plan → execute → verify, with checkpoints).
- Use the `/oracle` skill (if available) for research-heavy questions; otherwise stick to repo conventions.

---

## Project structure (quick map)

```
AGENTS.md, CLAUDE.md, .cursorrules, .windsurfrules      # AI-agent contracts
README.md, CONTRIBUTING.md                              # human-facing
docs/                                                   # deep docs
  ARCHITECTURE.md     # why these tech decisions, data model
  API.md              # REST API reference
  DEPLOY.md           # production deploy runbook
  ROADMAP.md          # what's next
  GSD-PLAYBOOK.md     # "build feature X" methodology
  EXTENDING.md        # plugin-style extension patterns
  B2B-DEPLOYMENT.md   # multi-tenant + white-label + SSO
  SKILLS-CATALOG.md   # AI-agent skills + when to invoke
prisma/schema.prisma                                    # data model source of truth
auth.ts, auth.config.ts, middleware.ts                  # Auth.js v5 wiring
src/
  app/                  # Next.js App Router
    dashboard/actions.ts    # ALL server actions
    api/**/route.ts         # REST endpoints
  components/{ui,layout,editor,project,task,pages,team,dashboard}/
  lib/{db,rbac,validation,api,colors,utils,invitations,pageTemplates}.ts
  types/next-auth.d.ts    # session augmentation
config/features.ts                                      # feature flag registry
scripts/                                                # bootstrap + maintenance
docker-compose.yml, Dockerfile, .env.example
```

---

## Commands

```bash
# Local dev
docker-compose up -d db                # Postgres on :5432
npm run dev                            # Next.js on :3000

# Database
npx prisma db push                     # dev: push schema, no migration history
npx prisma migrate dev --name foo      # prod-bound migration
npm run db:seed                        # admin + starter tags

# Quality gates (all must pass before commit)
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build

# Codex / Cursor / Aider integration
codex review                           # diff review against AGENTS.md
codex challenge                        # adversarial bug-finding
cursor .                               # auto-loads CLAUDE.md + .cursorrules
aider --read AGENTS.md <files>
```

---

## When to escalate to a human

- Schema migration that drops a column → ask first
- Auth flow change → ask first
- Adding a new external dependency → ask first
- Anything in `prisma/schema.prisma` other than purely additive changes → ask first
- Removing a public API endpoint → ask first

---

## Don't waste cycles on

- Reformatting existing files unrelated to your change
- Adding `dark:` variants (dead code in v1.9+)
- "Refactoring" patterns you don't have evidence are wrong
- Writing tests for code you also wrote in the same PR (write them first, or in a separate PR)
- Adding emojis to code or commit messages
- Comments that say "what" instead of "why"

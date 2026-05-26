# GSD Playbook — Build any feature in OfficeHub

> **GSD = Get Shit Done.** Inspired by the methodology G uses across MAX HQ
> (1000+ phases shipped). This playbook is the open-source distillation: any
> contributor or AI agent can pick up a feature idea and run it through the same
> rigor without G's full toolchain.

The methodology has **7 phases**. Each phase has explicit success criteria.
Each phase produces an artifact (PLAN.md, code commit, REVIEW.md, etc.).
If a phase fails its success criteria, you don't proceed — you fix or escalate.

---

## The 7 phases

```
┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
│ 1 GOAL │ → │ 2 PLAN │ → │ 3 EXEC │ → │ 4 TEST │ → │ 5 REVW │ → │ 6 SHIP │ → │ 7 LEARN│
└────────┘   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘   └────────┘
```

| # | Phase | Artifact | Success criterion |
|---|---|---|---|
| 1 | Goal | `.planning/<feature>/GOAL.md` | One-paragraph goal + 3 success metrics |
| 2 | Plan | `.planning/<feature>/PLAN.md` | File-by-file diff plan + risks + pattern map |
| 3 | Execute | atomic git commits | Each commit compiles + passes typecheck |
| 4 | Test | passing test suite | New code has ≥ 80% line coverage |
| 5 | Review | `.planning/<feature>/REVIEW.md` | Codex/Claude review + human approval |
| 6 | Ship | PR merged to main | CI green, deployed, smoke-tested |
| 7 | Learn | `.planning/<feature>/RETRO.md` | What worked, what didn't, what to bake into rules |

---

## Phase 1: Goal (5 minutes)

Write `.planning/<feature>/GOAL.md`. Template:

```markdown
# Goal: <one-line feature name>

## Why
<one paragraph — what problem does this solve, for whom>

## Success looks like
- [ ] <observable thing #1 — user can do X>
- [ ] <observable thing #2>
- [ ] <observable thing #3>

## Non-goals
- Not doing: <thing you might be tempted to add but shouldn't>
- Not doing: <another>

## Touches
- Schema: <yes/no, which tables>
- API: <yes/no, which routes>
- UI: <yes/no, which pages>
- Auth: <yes/no, which roles>
```

**Why this exists:** writing the goal down catches scope-creep before code. If you can't write 3 success criteria, you don't understand the feature yet.

---

## Phase 2: Plan (15 minutes)

Write `.planning/<feature>/PLAN.md`. Template:

```markdown
# Plan: <feature>

## File-by-file diff
- `prisma/schema.prisma` — add Sprint model + relation to Task
- `src/lib/validation.ts` — sprintCreateSchema + sprintUpdateSchema
- `src/app/dashboard/actions.ts` — createSprint, updateSprint, deleteSprint, assignTaskToSprint
- `src/app/dashboard/projects/[id]/page.tsx` — render <SprintList> above tasks
- `src/components/sprint/SprintList.tsx` — new client component, quick-add row
- `src/components/sprint/SprintForm.tsx` — start/end date + goal
- `docs/ARCHITECTURE.md` — append Sprint data model

## Pattern map (which existing feature is this like)
- Like Tasks (uses TaskQuickAdd inline-add pattern)
- Like Milestones (uses dueDate-based sorting)
- Different from: Tags (no many-to-many; one-to-many: Sprint hasMany Task)

## Risks
- R1: existing Task.parentId already used for subtasks — won't collide with Sprint
- R2: Sprint-task assignment requires updating TaskTable column — UI work + table re-render
- R3: backfilling existing tasks: every Task gets sprintId=NULL on migration; no data loss

## Verification
- After Phase 4 tests pass, manually click through:
  - Create sprint with valid dates
  - Assign 3 tasks to sprint
  - Sprint detail page shows tasks
  - Reject invalid date range (end < start)
```

**Why this exists:** without a file-by-file plan, you write speculative code that gets thrown out. The pattern map prevents reinventing patterns the codebase already has.

---

## Phase 3: Execute (variable)

Implement the plan. **Atomic commits** — one logical unit per commit:

```bash
git checkout -b feat/sprints

# Commit 1: schema
# ... edit prisma/schema.prisma, run db push
git add prisma/schema.prisma
git commit -m "feat(schema): add Sprint model"

# Commit 2: validation + actions
git add src/lib/validation.ts src/app/dashboard/actions.ts
git commit -m "feat(actions): sprint CRUD server actions"

# Commit 3: UI
git add src/components/sprint/ src/app/dashboard/projects/
git commit -m "feat(ui): SprintList + SprintForm on project detail"

# Commit 4: docs
git add docs/ARCHITECTURE.md
git commit -m "docs: append Sprint to data model"
```

Each commit MUST:
- Compile (`npx tsc --noEmit`)
- Pass typecheck strict (`npx tsc --noEmit --noUnusedLocals --noUnusedParameters`)
- Not leave the app broken (you can always run `npm run dev` and the page loads)

---

## Phase 4: Test (30 minutes — depends on feature)

Write tests under `tests/` (when test harness lands) or `src/**/__tests__/`. For now (pre-Vitest harness):

- **Manual smoke test** — click through the success criteria from Phase 1
- **REST API test** — `curl` each new endpoint, verify response shape + auth gate
- **RBAC test** — log in as MEMBER, MANAGER, ADMIN; verify each role sees what they should and is blocked from what they shouldn't

When Vitest lands: write `*.test.ts` files mirroring the source tree. Each server action gets a test covering: happy path + invalid input + forbidden access.

---

## Phase 5: Review (15 minutes)

Run AI reviewers + ask a human:

```bash
codex review                           # OpenAI Codex independent review
# OR
# Use Claude Code's review skill on the diff
```

Write `.planning/<feature>/REVIEW.md` capturing what reviewers flagged and how you resolved each item. Don't ship until every reviewer item is either fixed or has an explicit "won't fix because X" note.

---

## Phase 6: Ship

```bash
# Push branch + open PR
git push -u origin feat/sprints
gh pr create --title "feat: sprints" --body "$(cat .planning/<feature>/PLAN.md)"

# After CI green + review approved:
gh pr merge --squash
```

Deploy (the standard `docker compose pull && docker compose up -d --build` if self-hosted).

Smoke test in prod — at minimum: the new feature works for ONE user end-to-end.

---

## Phase 7: Learn (5 minutes)

Write `.planning/<feature>/RETRO.md`. Template:

```markdown
# Retro: <feature>

## What went well
- <thing>

## What went badly
- <thing>

## What I'd do differently
- <thing>

## What to bake into the rules
- <rule to add to AGENTS.md / .cursorrules / CLAUDE.md>
```

Update `AGENTS.md` with any new convention discovered. The methodology improves with each ship.

---

## Skipping phases

You CAN skip phases for tiny work (typo fix, dependency bump, comment-only changes). The rule: skip only if you can defend the skip out loud to another engineer.

**Never skip:**
- Schema changes — always do Phase 2 plan + Phase 5 review (a bad migration is forever)
- Auth/RBAC changes — always do Phase 2 plan + Phase 5 review (a permission bug is a breach)
- Anything that touches money, billing, secrets, or user PII

---

## Tooling that automates phases (optional)

If you want to formalize this with G's MAX HQ GSD toolchain:

```bash
# Set up phase directory + GOAL template
mkdir -p .planning/<feature> && cp docs/_templates/GOAL.md .planning/<feature>/

# Or, if you have the gsd CLI installed (separate project):
gsd new-phase <feature>      # creates .planning/<feature>/ with templates
gsd plan-phase <feature>     # AI-assisted plan generation
gsd execute-phase <feature>  # AI-assisted implementation
gsd verify-phase <feature>   # automated success-criteria check
gsd ship-phase <feature>     # PR + merge automation
```

The GSD CLI is its own project (not part of OfficeHub). This playbook works without it — the CLI just removes typing.

---

## Why 1000+ phases

The MAX HQ methodology has shipped 1000+ phases because each phase is small (1-3 hours of work). A "phase" is one focused unit: add a model, fix a bug, write a runbook, ship a button.

For OfficeHub: aim for phases that ship in **under one work session** (≤4 hours). Larger work = split into a phase sequence.

Example phase sequence for "Add Sprints":
- Phase 1: Sprint model + actions
- Phase 2: SprintList UI + assignment
- Phase 3: Sprint detail page
- Phase 4: Burndown chart
- Phase 5: Sprint reports + retrospective view

Each is its own GOAL/PLAN/EXEC/TEST/REVIEW/SHIP/LEARN cycle. Cumulatively they deliver "Sprints" as a feature.

---

## TL;DR

1. **GOAL** — 3 success criteria, one paragraph why
2. **PLAN** — file-by-file diff + risks + verification steps
3. **EXEC** — atomic commits, each one compiles
4. **TEST** — manual smoke + RBAC matrix + (eventually) automated tests
5. **REVIEW** — Codex/Claude + human
6. **SHIP** — PR, merge, deploy, smoke
7. **LEARN** — retro + update the rules

When in doubt, refer back to this file. When a new pattern emerges, add it here.

# CODEX.md — OpenAI Codex CLI guide for OfficeHub

> Primary doc: [`AGENTS.md`](AGENTS.md) — Codex auto-loads it.
> This file documents the **Codex-specific commands and patterns** the rest of the docs reference.

---

## Setup

```bash
# Once, on your machine:
npm install -g @openai/codex@latest
codex auth login

# Clone OfficeHub + open:
git clone https://github.com/GopalGB/officehub.git
cd officehub
```

Codex auto-loads `AGENTS.md` from the repo root. No further config needed.

---

## Daily commands

```bash
# Independent diff review against AGENTS.md conventions
codex review

# Adversarial mode — Codex tries to break your code
codex challenge

# Open consultation thread (session continuity for follow-ups)
codex consult "Does setProjectTags properly enforce member permissions?"

# Pair-programming session
codex
```

---

## When to use Codex vs Claude Code

| Task | Use |
|---|---|
| Independent second opinion on a diff | `codex review` |
| Find subtle bugs you might have missed | `codex challenge` |
| Architecture question, want a counter-perspective | `codex consult "..."` |
| Long multi-file refactor with planning | Claude Code |
| Quick fix to a single file | Either, but Claude tends to be faster |
| "Add a new entity end-to-end" | Either — both follow `docs/EXTENDING.md` |
| Large research-heavy work (compare 5 frameworks) | Claude Code with `/oracle` skill |

---

## Tested recipes

### Recipe 1: Add a new entity (Sprint, in this case)

```bash
codex consult "I want to add a Sprint model that groups tasks. \
  Read docs/EXTENDING.md and propose the 7-phase plan. Don't write code yet — \
  just the plan with file paths."

# Review the plan. If it looks right:
codex "implement the plan you just proposed"

# Verify:
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build

# Independent review:
codex review
```

### Recipe 2: Bug fix with regression test

```bash
codex consult "There's a bug where MEMBER role users can't see projects \
  they're added to via Members. Read src/lib/rbac.ts and src/app/dashboard/page.tsx, \
  trace the issue, propose a fix."

# Review. Then:
codex "implement the fix and add a server-action test that would have caught this"
```

### Recipe 3: Adversarial security check

```bash
codex challenge "Look at src/app/dashboard/actions.ts. Try to find a way \
  for a MEMBER user to delete a project they don't own, or to escalate to ADMIN. \
  Report any path you find."
```

### Recipe 4: Performance audit

```bash
codex consult "Audit src/app/dashboard/page.tsx for N+1 query patterns and \
  missing indexes. Reference prisma/schema.prisma. Suggest @@index additions."
```

---

## Model selection

Codex CLI defaults to the current GPT-5-class model. For OfficeHub work:
- **Default model** for everything routine
- **Reasoning models** (e.g. `o1`, `o3`) — explicitly select for: schema design, complex refactors, security review
- **Fast models** (e.g. `gpt-4.1-mini`) — explicitly select for: typo fixes, comment additions, README edits

Switch model:
```bash
codex --model o3 review
```

---

## Hooks + slash commands

If you want Codex to auto-run quality gates after every change, create `.codex/hooks.json`:

```json
{
  "post-edit": "npx tsc --noEmit --noUnusedLocals --noUnusedParameters",
  "pre-commit": "npm run build"
}
```

(Codex picks this up automatically when the file exists.)

---

## What NOT to do with Codex

- Don't paste secrets into the chat. Codex sees what you type.
- Don't run `codex` in a worktree with uncommitted changes you care about — review the diff before accepting.
- Don't override `AGENTS.md` conventions in a prompt — if you disagree with a rule, update `AGENTS.md` first.
- Don't ask Codex to "skip the type errors" — fix them.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Codex doesn't see AGENTS.md | Wrong working dir | `cd` to repo root before running |
| Codex makes changes that crash | Skipped quality gates | Run `npx tsc` + `npm run build` after every Codex change |
| Codex repeats a mistake the rules forbid | Rules aren't sticky enough | Move the rule to AGENTS.md "Hard rules" section; Codex re-reads on next session |
| Codex hallucinates a file path | Stale repo view | `codex consult "list the files under src/app/dashboard/"` to re-anchor |

---

## Version

This guide tracks Codex CLI v0.x (verify with `codex --version`). When Codex CLI changes its commands, update this file in the same PR.

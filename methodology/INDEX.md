# Methodology Index

OfficeHub follows a 7-phase methodology for shipping features. Inspired by MAX HQ's "Get Shit Done" (GSD) workflow used across 1000+ shipped phases.

## Documents

- **[`docs/GSD-PLAYBOOK.md`](../docs/GSD-PLAYBOOK.md)** — the 7-phase methodology in detail (Goal → Plan → Execute → Test → Review → Ship → Learn)
- **[`docs/EXTENDING.md`](../docs/EXTENDING.md)** — 8 recipes for common extension patterns
- **[`AGENTS.md`](../AGENTS.md)** — the agent-facing summary of conventions

## Recipes

| Recipe | Purpose | Time | Difficulty |
|---|---|---|---|
| [`recipes/add-entity.md`](recipes/add-entity.md) | Add a new model + actions + UI end-to-end | ~2h | Medium |
| _(planned)_ recipes/add-integration.md | Hook into a third-party service (Slack, GitHub, etc) | ~3h | Medium |
| _(planned)_ recipes/add-plugin.md | Build a plugin under `plugins/` | ~4h | Hard |
| _(planned)_ recipes/migrate-schema.md | Safe production schema migration | ~1h | Hard |
| _(planned)_ recipes/upgrade-deps.md | Major version dependency bump | ~2h | Medium |

## Status conventions

In phase plan files, use these markers:
- `🟢 done` — shipped to main + verified
- `🟡 doing` — in progress
- `🔵 planned` — committed but not started
- `⚪ idea` — proposed, not committed
- `🔴 blocked` — needs decision or input
- `⚫ killed` — explicitly decided not to do

## Phase artifacts

Each phase lives under `.planning/<feature-slug>/` with these files:
- `GOAL.md` — one-paragraph "why" + 3 success criteria
- `PLAN.md` — file-by-file diff + risks + verification steps
- `REVIEW.md` — captured AI/human review findings + resolutions
- `RETRO.md` — what went well, what didn't, what to bake into the rules

The `.planning/` directory is gitignored from the public repo but documented as the standard location.

## Commit conventions

Follow [Conventional Commits v1.0](https://www.conventionalcommits.org/en/v1.0.0/):
- `feat(scope): what (why)` — new functionality
- `fix(scope): what (why)` — bug fix
- `docs(scope): what` — docs only
- `refactor(scope): what (why)` — neither feat nor fix
- `test(scope): what` — test additions
- `chore(scope): what` — tooling, deps, config

For AI-pair commits (Codex / Claude / Cursor), append a trailer line:
```
Co-Authored-By: Claude Opus <noreply@anthropic.com>
```
or whichever model authored. Helps trace attribution + audit.

## Why this methodology

A 1000+ phase project doesn't accumulate that count by being slow. It accumulates by making each phase **small, atomic, and verifiable**. The 7 phases are deliberate friction: they slow down code-typing in exchange for catching mistakes earlier, where they're cheap to fix.

For OfficeHub: aim for phases that ship in **under one work session** (≤4 hours). Larger work = split into a phase sequence. The recipe in `recipes/add-entity.md` is one such phase, sized for a single session.

## Tooling that automates the phases (optional)

If you want to formalize this with a CLI (separate project from OfficeHub):

```bash
gsd new-phase <feature>      # creates .planning/<feature>/ with templates
gsd plan-phase <feature>     # AI-assisted plan generation
gsd execute-phase <feature>  # AI-assisted implementation
gsd verify-phase <feature>   # automated success-criteria check
gsd ship-phase <feature>     # PR + merge automation
```

The CLI is optional — the methodology works without it. The CLI just removes typing.

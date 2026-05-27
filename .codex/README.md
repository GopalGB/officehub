# .codex/

OpenAI Codex CLI project-level config for OfficeHub.

## Files

| File | Purpose |
|---|---|
| `config.json` | Sample Codex config — context files to always read, ignore paths, hooks, commit conventions |

## Usage

Codex CLI auto-detects `.codex/config.json` in the working directory. No setup needed beyond cloning the repo.

To use these settings globally instead of per-project, copy them into `~/.codex/config.json`:
```bash
cp .codex/config.json ~/.codex/config.json
```

## What this config does

- **`context.alwaysReadFiles`** — Codex preloads `AGENTS.md`, `CLAUDE.md`, `BUILD.md`, and `CODEX-PLAYBOOK.md` at session start. No need to remind Codex about project conventions.
- **`context.ignorePaths`** — Codex skips `.next/`, `node_modules/`, etc. so it doesn't waste context on generated/vendored code. Critically: blocks `.env` from being read so secrets never enter context.
- **`hooks.post-edit`** — runs strict typecheck after every Codex-applied edit. Catches errors immediately.
- **`hooks.pre-commit`** — runs full build before any Codex-initiated commit. Stops broken PRs at the source.
- **`conventions`** — branches use `feat/codex/<name>`, commits use Conventional Commits, an AI trailer makes Codex authorship traceable in `git log`.

## See also

- [`../AGENTS.md`](../AGENTS.md) — universal agent rules (Codex reads this first per the agents.md spec)
- [`../CODEX.md`](../CODEX.md) — Codex CLI commands + tested recipes (for the developer using Codex)
- [`../CODEX-PLAYBOOK.md`](../CODEX-PLAYBOOK.md) — "adapt this for my company" brief (for Codex itself)
- [`../BUILD.md`](../BUILD.md) — build/test/deploy reference

## When the Codex CLI config schema evolves

The OpenAI Codex CLI is actively developed. If a config key here stops working with newer Codex versions, check the official schema at https://github.com/openai/codex and update accordingly.

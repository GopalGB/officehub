# Skills Catalog — AI agents you can pair with OfficeHub

> This is the menu of AI-agent capabilities that work well with OfficeHub.
> Every entry shows: what it does, when to invoke, and a worked example.

The list is opinionated — only skills that have shipped real value on OfficeHub itself. We don't pad with hypotheticals.

---

## Tier 1: ship-critical skills (use on every PR)

### Codex review
Independent diff review by OpenAI Codex CLI.

**When:** before opening any non-trivial PR.
**Command:** `codex review`
**What you get:** a list of bugs, perf issues, security smells found in the diff. Sorted by severity.
**Reference:** [`CODEX.md`](../CODEX.md)

### Claude Code review
The built-in `review` skill in Claude Code. Reads the diff, checks AGENTS.md compliance.

**When:** before opening any non-trivial PR, alongside Codex review (second opinion).
**Command:** in Claude Code chat: `review the current diff at high effort`
**What you get:** structured findings + suggested fixes you can apply inline.

### TypeScript strict gate
Pre-commit gate: zero unused locals, zero unused parameters, zero `any`.

**When:** before every commit.
**Command:** `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
**What you get:** zero exit code = ok, non-zero = fix before committing.

---

## Tier 2: feature-development skills (invoke for new features)

### GSD plan-phase
Generates a structured plan for adding a new entity / feature. Follows the 7-phase GSD methodology.

**When:** before writing code for any feature larger than a single-file change.
**Manual version:** follow [`docs/GSD-PLAYBOOK.md`](GSD-PLAYBOOK.md)
**Tooling (optional):** `gsd plan-phase <feature-name>` if you have the GSD CLI installed

### EXTENDING recipes
The pre-baked recipes in [`docs/EXTENDING.md`](EXTENDING.md). Each is a copy-pasteable template for the most common extensions:
- Add a new entity end-to-end
- Add a REST endpoint
- Add a feature flag
- Add a wiki page template
- Add a keyboard shortcut
- Add a new RBAC permission
- Add a third-party integration
- Add a chart

**When:** at the start of any extension work — check if your work matches a recipe first.

### Pattern-mapper (find what to copy from)
Before building anything new, ask: "what pattern in the codebase is closest to what I need?" The `Patterns in the codebase to copy from` table in EXTENDING.md is the menu.

**Manual:** read the table, pick the closest, copy + adapt.
**With Claude Code:** "Find the pattern in this codebase closest to <thing I want to build>, then implement my feature following that pattern."

---

## Tier 3: research + adversarial skills (use when something feels off)

### Codex challenge
Adversarial mode. Codex tries to find security holes, edge-case bugs, race conditions.

**When:** before merging anything that touches auth, payments, or PII.
**Command:** `codex challenge "Try to find a way to escalate from MEMBER to ADMIN in this codebase"`

### Oracle (Claude Code skill)
Deep web research — 16 parallel engines, vault-backed.

**When:** evaluating new libraries, comparing approaches, scouting integrations.
**Command:** in Claude Code: `/oracle <research question>`
**Note:** runs at full depth by default; pass `--depth=light` for quick scans.

### Web search agent
A general-purpose research agent dispatched in the background while you continue building.

**When:** you need a piece of information to inform a decision but can keep working in parallel.
**Pattern:** dispatch an Agent with subagent_type=general-purpose, run_in_background=true, prompt with explicit success criteria and output format.

---

## Tier 4: workflow + meta skills

### git-advanced
For complex rebases, interactive history rewrites, conflict resolution.

**When:** you got into git trouble. AI is better than `man git` at "what command do I need now?"
**Command:** in Claude Code: `/git-advanced "I want to undo the last commit but keep the changes staged"`

### code-review (slash command)
Reviews the current diff at high effort. Different from `codex review` — uses Claude rather than GPT, lighter-weight setup.

**When:** small diffs, fast feedback.
**Command:** in Claude Code: `/code-review --effort high`

### testing-strategies
Picks the right test approach for a piece of code (unit / integration / E2E / snapshot).

**When:** writing tests for the first time on a new code shape.
**Manual:** [`docs/GSD-PLAYBOOK.md#phase-4-test`](GSD-PLAYBOOK.md) covers the testing pyramid for OfficeHub.

---

## Tier 5: writing + comms

### technical-writer
For drafting docs, runbooks, API references, release notes.

**When:** the diff is meaningful and the README / CHANGELOG hasn't been updated.
**Pattern:** "rewrite the section X in docs/Y.md to incorporate the changes in this PR, keeping the same tone and structure."

### prompt-engineer
For tuning prompts in code (system prompts, eval rubrics, AI-generated content).

**When:** OfficeHub doesn't ship LLM features yet, but if you add one (e.g. AI summary of project updates), use this to design the prompt.

---

## How to invoke skills in different agents

| Agent | Skill invocation |
|---|---|
| **Claude Code** | Slash commands: `/oracle`, `/review`, `/code-review`. Or in chat: "use the technical-writer skill to draft a release note." |
| **OpenAI Codex CLI** | Subcommands: `codex review`, `codex challenge`, `codex consult "..."`. |
| **Cursor** | Compose pane — reference patterns from `.cursorrules`. No formal skill system; use prompts that point at docs. |
| **Windsurf** | Cascade — similar to Cursor. Reference `.windsurfrules`. |
| **Aider** | `aider --read AGENTS.md src/path/to/file.ts` — `aider` doesn't have skills, but loading AGENTS.md gives it project context. |

---

## When NOT to use a skill

- The change is one-line and obvious — just make it
- You already know what to do — typing is faster than prompting
- The skill's setup time > the task time

Skills are leverage when the task is bigger than the prompt. For tiny work, they're overhead.

---

## Add a new skill to this catalog

If you find a workflow that materially helps OfficeHub development, add it here. Format:

```markdown
### <Name>
<One-line description>

**When:** <trigger>
**Command:** <invocation>
**What you get:** <output shape>
```

Then submit a PR. Catalog grows as the team's collective experience grows.

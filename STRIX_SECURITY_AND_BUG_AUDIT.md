# OfficeHub Security & Bug Audit — Fixes Applied (2026-10-23)

Audit performed with the Strix (usestrix/strix) methodology: broken access control / IDOR,
auth & session flaws, input validation, state integrity, frontend UX. Every finding below
was verified against the actual code before fixing; findings that did not hold up are
listed at the bottom. Supersedes the earlier draft of this file from the Gemini bundle.

## Applied

| ID | Severity | File(s) | Issue | Fix |
|----|----------|---------|-------|-----|
| OH-01 | High | `src/app/api/projects/route.ts` | `Number(searchParams.get("limit"))` passed NaN into Prisma `take` → unhandled 500 | Clamp to integer 1..100 with finite check |
| OH-02 | High | `src/app/api/projects/route.ts` | `POST /api/projects` let any MEMBER forge `ownerId` | Custom `ownerId` honored only for manager+ |
| OH-03 | High | `src/app/api/projects/route.ts` | `?owner=<id>` overwrote `scope=mine`; unknown `scope` values bypassed the MEMBER gate entirely and listed all projects | `scope=mine` locks the filter; every non-`mine` scope requires manager+ |
| OH-04 | High | `src/app/api/projects/[id]/{enhancements,milestones,updates}/route.ts` | POSTs open to any authenticated user (create enhancements/milestones/updates on any project); GETs denied project *members* who weren't owners | Writes require `canEditProject`; reads use new `canViewProject` (manager+ / owner / member) |
| OH-06 | High | `auth.ts` | `bcrypt.compare` on a user with empty `passwordHash` (OAuth/invite flows) crashes; email not trimmed | `!user.passwordHash` guard + `email.trim().toLowerCase()` |
| OH-07 | Medium | `auth.config.ts` | Edge middleware missed `/api/me`, `/api/search`, `/api/workspace` | Added to `isProtected` |
| OH-08 | High | `src/app/dashboard/actions.ts` | `updateTask` and `quickAssignTask` checked only the session — any signed-in user could edit/reassign any task (IDOR). (`moveTask`/`deleteTask` already had checks.) | Both now enforce project-editor-or-reporter/assignee, same rule as `moveTask` |
| OH-10 | Medium | `src/components/board/dnd-helpers.ts` | `computePlacement` resolved "below" whenever the translated rect was null (fast release / scroll) | Fall back to the initial rect |
| OH-12 | Low | `TaskKanbanCard`, project `KanbanCard`, `calendar/page` | UTC-midnight due dates compared against local "now" → items due today flagged overdue in western timezones | New `isOverdueDate()` in `src/lib/utils.ts` compares calendar days; applied in all three places |
| OH-13 | Low | `src/components/layout/Sidebar.tsx` | "Admin" heading (with Settings) rendered for MEMBERs | Settings moved to a "Workspace" section; Admin section strictly `isAdmin` |

New helper: `canViewProject()` in `src/lib/rbac.ts` (read-side mirror of `canEditProject`).

## Investigated, not real (no change)

- **OH-05** search wildcard "injection": Prisma `contains` treats `%`/`_` literally (no raw LIKE),
  and the original route already role-scopes projects/tasks and enforces `q.length >= 2`.
  Pages/users search is workspace-global by design in this internal tool.
- **OH-09** rebalance stale-orderIndex: the real code recomputes `newOrderIndex` from indexes
  inside every `needsRebalance` branch; `midpoint()`'s stale read is always overwritten.

## Not applied

- **OH-14** white-label branding: the delivered bundle shipped an API route + Prisma model but
  no settings UI, so the feature could not work as delivered. Needs its own change
  (schema migration + settings page + sidebar/header wiring).

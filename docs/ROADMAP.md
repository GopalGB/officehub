# Roadmap

> What's intentionally not in v1, and what should come next.

## v1.1 (next, small lifts)

- **File attachments** — wire `Project.attachments[]` against `UPLOAD_DIR`. The `uploads` Docker volume is already mounted.
- **Search** — Postgres full-text search across titles, summaries, comments, and update content.
- **Audit log** — `AuditLog` model exists; instrument all `db.*.create/update/delete` calls in `actions.ts` to write events.
- **Email notifications** — SMTP-backed digest of overdue projects to the project owner + their manager.
- **Project assignees** — beyond a single owner, support multiple `Project ↔ User` collaborators with their own permission tier.

## v2 (medium lifts — earn them when v1 has stuck)

- **Better-Auth migration** — research-recommended replacement for Auth.js. Built-in RBAC + organisations + email-password + magic-link, sessions in DB (immediate invalidation). Plan: parallel-run both, dual-write user creation, cut over on the next major release.
- **SSO** — OIDC / SAML provider behind Auth.js. Useful when the office has Google Workspace or Microsoft 365.
- **Workspaces / multi-team** — currently every user is in one shared office. Add `Workspace` model, scope every query, allow users to belong to multiple workspaces.
- **API tokens** — long-lived bearer tokens for external automation, in addition to session cookies.
- **Timeline / Gantt view** — visualize milestones across all projects.
- **Saved manager views** — filter combinations saved per-user.

## v3 (longer lifts — explicit decision required)

- **Real-time collaborative editing** — Yjs sync over WebSockets, integrated with BlockNote's collab support. Adds Redis dependency.
- **Public read-only sharing** — generate signed URLs for stakeholders without seats.
- **Slack / Teams notifications** — incoming webhooks on status changes.
- **Mobile app** — React Native or PWA — only if usage data justifies it.
- **AI-powered status summaries** — weekly digest generated from project updates, calling out at-risk projects. Use any LLM provider behind a flag.

## Explicit non-goals (today)

- Building a Notion clone for personal use. This is scoped to an office team.
- Replacing Jira / Linear. We're project tracking + status, not ticket management.
- Hosted SaaS version. Out of scope for the internal-tool use case.

## Migration / data hygiene work that will need to happen eventually

- Move BlockNote content to a separate `documents` table once one project has >50 updates — keeps the project queries cheap.
- Partition the `audit_log` table by month once it has >1M rows.
- Add an `archived_projects` table or use a `tombstone` pattern instead of `ARCHIVED` status — keeps queries simple.

# Contributing to OfficeHub

Thanks for the interest. OfficeHub is built to be small, self-hosted, and
hackable. PRs that fit those values are welcome.

## Quick start (5 minutes)

```bash
git clone https://github.com/GopalGB/officehub.git
cd officehub
cp .env.example .env
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env

docker-compose up -d db
npm install
npx prisma db push
npm run db:seed
npm run dev
# → http://localhost:3000
# Login: admin@office.local / Office2026!Admin
```

That's the whole loop. Hot reload runs on every save.

## Filing an issue

Before opening one:
- Search existing issues (open + closed)
- Try to reproduce on a fresh clone (`docker compose down -v` first to wipe)
- Include: OS, Node version, Docker version, exact commands to repro,
  the actual error vs expected

For bug reports, the more concrete the better. "Calendar page broken" tells
us nothing; "Calendar page shows 0 events even though my project has a
milestone with due date 2026-06-15" gives us a test case.

## Sending a PR

1. **Fork + branch.** Branch naming: `feat/<short>`, `fix/<short>`, `docs/<short>`.
2. **Read `AGENTS.md`.** It has the project's invariants (TypeScript strict,
   RBAC rules, server-action patterns, etc.). Following it is the fastest
   path to merge.
3. **Make focused changes.** One PR = one concern. A 50-file diff is a hard
   sell.
4. **Keep TypeScript strict.** Run `npx tsc --noEmit --noUnusedLocals
   --noUnusedParameters` before pushing. Zero warnings is the bar.
5. **Run `npm run build`.** Has to pass.
6. **Manual test the path.** We don't have e2e tests yet — your eyes are
   the test runner. Click through the flow you touched.
7. **Update the docs.** If you change behavior, update README / DEPLOY /
   ARCHITECTURE / AGENTS / API as appropriate.
8. **Write a real commit message.** Conventional commits (`feat:`, `fix:`,
   `docs:`, `refactor:`). Body explains *why*, not *what*.
9. **Open the PR.** Describe what changed, how to test, and any tradeoffs
   you made. Screenshots if UI.

## Areas that need help

These are good first PRs:

- **Tests.** Vitest + Playwright setup. We have zero tests; adding the harness
  and even a smoke test would be huge.
- **Internationalization.** All strings are hard-coded English. Adding
  `next-intl` and extracting strings would be valuable.
- **File attachments.** Schema can hold attachments, but the upload pipeline
  isn't wired. `UPLOAD_DIR` env var exists; mount path is in docker-compose.
- **Full-text search across BlockNote content.** Currently search hits titles
  and summaries only.
- **Email notifications.** Daily digest of due / overdue items.
- **Subtasks UI.** `Task.parentId` is in the schema; UI doesn't expose it
  yet.
- **Drag-and-drop on Kanban.** Currently you click the status pill to move.
  D&D would be nicer.
- **Sprint model.** Group tasks into time-boxed sprints.
- **PDF export.** Print a project's full state (description + tasks +
  timeline + comments) as a printable PDF.

## Areas that need NOT to change

- **Architecture stays Postgres + Next.js.** No Redis / MongoDB / Kafka /
  microservices. The whole point is single-host operability.
- **No SaaS dependencies.** No telemetry, no analytics ping-outs, no
  feature-flag service. Self-hosted means "works on a closet server with no
  internet."
- **No removing the invite + admin-set-password dual flow.** Both paths
  exist because both have legitimate use cases.
- **No replacing BlockNote with something heavier.** If you outgrow it, drop
  to Tiptap directly (same ProseMirror foundation).

## License

MIT. By contributing you agree your contribution is MIT-licensed.

## Code of conduct

Be excellent to each other. Disagreement on design is fine. Disagreement on
people is not.

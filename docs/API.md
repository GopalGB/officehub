# REST API Reference

OfficeHub ships a REST API alongside the UI. It uses the same session cookie
that the UI uses — sign in via the UI first, then hit endpoints with the
session cookie attached. Token-based auth (PATs) is on the roadmap.

All responses are `{ data: ... }` on success or `{ error: { code, message,
details? } }` on failure.

## Conventions

| Aspect | Convention |
|---|---|
| Format | JSON in, JSON out |
| Status codes | 200 read, 201 create, 204 delete, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 invalid input, 500 internal |
| Pagination | Cursor not yet implemented. Lists default to 50, capped 200 via `?limit=` |
| Filtering | Per-endpoint query params (see below) |
| Errors | `{ "error": { "code": "FORBIDDEN", "message": "Cannot edit this project" } }` |

## Auth

For local testing, sign in via `/login` in a browser, copy the
`__Secure-next-auth.session-token` (or `next-auth.session-token` in dev)
cookie, then attach it:

```bash
curl -s -H "Cookie: next-auth.session-token=<token>" \
  http://localhost:3000/api/me
```

For production scripts, ask an admin to create a service-user account and
sign in once through Puppeteer/Playwright to harvest the cookie.

---

## Endpoints

### `GET /api/me`
Current user.

**Response 200**
```json
{ "data": { "id": "ckxyz...", "email": "admin@office.local", "name": "Admin", "role": "ADMIN" } }
```

### `GET /api/health`
Public liveness + DB-reachability check.

**Response 200**
```json
{ "status": "ok", "db": "ok", "ts": "2026-05-24T10:00:00.000Z" }
```

Returns HTTP 503 with `db: "error"` if Postgres is unreachable.

---

### `GET /api/search?q=<term>`
Multi-entity search. Case-insensitive. Minimum 2 chars.

| Param | Notes |
|---|---|
| `q` (required) | Search term |

Scope: MEMBER role sees only own projects + own assigned/reported tasks +
all pages + all users. MANAGER+ sees everything.

**Response 200**
```json
{
  "data": {
    "projects": [{ "id", "title", "summary", "status" }],
    "tasks":    [{ "id", "title", "status", "projectId", "project": { "title" } }],
    "pages":    [{ "id", "title", "emoji" }],
    "users":    [{ "id", "name", "email", "role" }]
  }
}
```

---

### `GET /api/projects?scope=mine|all&status=&owner=&limit=`

| Param | Default | Notes |
|---|---|---|
| `scope` | `mine` | `mine` — owned by viewer. `all` — manager+ only |
| `status` | — | One of `PLANNING / IN_PROGRESS / BLOCKED / ON_HOLD / COMPLETED / ARCHIVED` |
| `owner` | — | Filter by owner user ID |
| `limit` | 50 | Cap 200 |

**403** if a MEMBER passes `scope=all`.

### `POST /api/projects`

Create a project. Owner defaults to caller; admins can pass `ownerId`.

**Request body**
```json
{
  "title": "Q3 launch",
  "summary": "Beta with 5 customers",
  "status": "PLANNING",
  "priority": "MEDIUM",
  "startDate": "2026-06-01",
  "targetDate": "2026-09-30"
}
```

**Response 201** → full project object.

### `GET /api/projects/:id`
Project detail (owner, milestones, enhancements, updates, comments).

**403** for MEMBER on a project they don't own.

### `PATCH /api/projects/:id`
Update fields. Same body shape as POST, all fields optional. Requires edit
permission (owner / member / manager+).

### `DELETE /api/projects/:id`
Hard delete. Owner or admin only.

---

### `GET /api/projects/:id/updates`
List status updates on a project.

### `POST /api/projects/:id/updates`
**Body** `{ "content": <BlockNote JSON array> }`

### `GET /api/projects/:id/enhancements`
### `POST /api/projects/:id/enhancements`
**Body**
```json
{
  "title": "Add dark mode",
  "description": "Users ask for it nightly",
  "status": "PROPOSED",
  "priority": "MEDIUM"
}
```

### `GET /api/projects/:id/milestones`
### `POST /api/projects/:id/milestones`
**Body** `{ "title": "Beta", "dueDate": "2026-08-01" }`

---

### `GET /api/users` *(manager+ only)*
List users.

### `POST /api/users` *(admin only)*
**Body**
```json
{
  "email": "alice@office.local",
  "name": "Alice",
  "password": "MinimumEightChars1!",
  "role": "MEMBER"
}
```

---

## Future endpoints (planned, not yet implemented)

- `PATCH /api/projects/:id/members` — set member list
- `POST /api/projects/:id/tasks` + `PATCH /api/tasks/:id` — task CRUD
- `GET/POST /api/pages` — wiki page CRUD
- `POST /api/auth/tokens` — long-lived PAT for service accounts
- `GET /api/audit-log` — audit trail (admin)

---

## Rate limits

None yet. Add in front of OfficeHub via your reverse proxy (nginx, Caddy,
Cloudflare) if you expose this publicly.

## Versioning

This is v1. We'll move to `/api/v1/` once we add `/api/v2/`. Endpoints in
v1 are stable — breaking changes get the v2 prefix.

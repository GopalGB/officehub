# B2B Deployment Guide

OfficeHub is built for small offices, but the same Docker stack handles real B2B usage with a few patterns. This doc covers the additions and tradeoffs.

---

## Choose a deployment model

| Model | When to use | Setup time |
|---|---|---|
| **Single-tenant per office** (default) | One company, one server, ≤200 users | 10 min |
| **Self-hosted on customer infra** (B2B install) | You sell installs to other companies; each runs their own | 30 min docs + their team |
| **Multi-tenant SaaS** (you operate) | One deployment serves multiple companies via subdomain | 1-2 days extra work |
| **Vendor-hosted** (you pay, customer uses) | White-glove for one customer | 1 day |

Single-tenant is the recommended default. Multi-tenant adds isolation work that most offices don't need.

---

## Single-tenant production deploy

The canonical path. Already covered in [`DEPLOY.md`](DEPLOY.md). Quick recap:

```bash
git clone https://github.com/GopalGB/officehub.git /opt/officehub
cd /opt/officehub
cp .env.example .env
# Edit .env: AUTH_SECRET, NEXTAUTH_URL, SEED_ADMIN_*, POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec app npx prisma db seed
```

Put it behind Caddy for HTTPS (snippet in DEPLOY.md). Done.

---

## B2B install (you ship to customer infra)

Customers have a wide range of skill. Make the install bulletproof:

### `scripts/setup.sh`

The repo includes a one-command bootstrap (clones, generates secrets, builds, seeds, prints credentials). Customers run:

```bash
curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup.sh | bash
```

The script:
1. Verifies Docker + git installed
2. Clones the repo to `/opt/officehub` (or `$OFFICEHUB_DIR`)
3. Generates `AUTH_SECRET` and `POSTGRES_PASSWORD` via `openssl rand`
4. Writes `.env` with sensible defaults
5. Runs `docker compose up -d --build`
6. Waits for Postgres health
7. Seeds the admin
8. Prints credentials + next-step instructions

### Customer-facing docs

In your sales/install material, point customers at:
- [`README.md`](../README.md) for product overview
- [`DEPLOY.md`](DEPLOY.md) for the manual install path
- This file for advanced configuration

Bundle a 1-page "Day 1 setup" PDF if your customers are non-technical (separate from this repo).

---

## Multi-tenant SaaS

If you want to run OfficeHub as a hosted service across many companies, you need:

### 1. Tenant isolation strategy

Pick **one** (don't mix):

| Strategy | Pros | Cons |
|---|---|---|
| **Database-per-tenant** | Hard isolation, easy backup/restore per customer, no cross-tenant leak possible | Migration overhead at scale, more infra |
| **Row-level (`tenantId` everywhere)** | Single DB, easy to query across | Every query needs `WHERE tenantId = ?` — one missed query = breach |
| **Schema-per-tenant** (Postgres schemas) | Middle ground — isolation without separate DBs | Schema migration tooling complexity |

**Recommendation for OfficeHub:** database-per-tenant. Reasons:
- The data model has ~20 tables — feasible to spin up per customer
- Maps cleanly to "each customer is one OfficeHub instance" — minimal code changes
- Backup = `pg_dump` per customer (clean billing for "export my data" requests)

### 2. Routing

Pick **one**:
- **Subdomain** (`acme.officehub.io`) — clean URLs, requires wildcard DNS + TLS
- **Path prefix** (`officehub.io/acme/...`) — easier ops, ugly URLs
- **Custom domain per tenant** (`workspace.acme.com`) — premium feature, needs cert provisioning

For Next.js multi-tenant subdomain routing, see Vercel's `multi-tenant-saas` example and adapt the middleware. The repo's `middleware.ts` is the place to extract `tenantSlug` from the host header.

### 3. Per-tenant DB selection

Add a middleware that picks the right Prisma client per request based on the tenant slug:

```typescript
// src/lib/db.ts (multi-tenant variant)
const clients = new Map<string, PrismaClient>();

export function dbForTenant(slug: string) {
  if (!clients.has(slug)) {
    const url = `postgresql://officehub:***@db:5432/officehub_${slug}`;
    clients.set(slug, new PrismaClient({ datasources: { db: { url } } }));
  }
  return clients.get(slug)!;
}
```

Every server action / API route then reads `request.headers.get("x-tenant")` and uses `dbForTenant(slug)` instead of the global `db`.

### 4. Tenant provisioning

Build a CLI or admin endpoint to:
1. Create new Postgres database (`CREATE DATABASE officehub_<slug>`)
2. Run migrations on it (`prisma migrate deploy` with the per-tenant URL)
3. Seed an admin
4. Set up DNS (if subdomain-per-tenant)
5. Provision TLS cert (Caddy On-Demand or cert-manager)

This is a **separate project from OfficeHub** — call it `officehub-control-plane` or similar. Don't bake it into the main repo unless you're committed to running multi-tenant SaaS as the core product.

### 5. Auth + cross-tenant safety

- Auth.js sessions are still per-tenant (each DB has its own User table)
- Add `X-Tenant` header to every API request (or read from host)
- Audit log every cross-tenant API call with a CRITICAL severity (any cross-tenant access is a bug)
- Run a periodic invariant check: count rows per table per tenant, compare to "expected zero in other tenant's data"

---

## White-label & theming

For B2B customers who want OfficeHub with their branding:

### Brand variables

Edit `config/branding.ts` (new):

```typescript
export const branding = {
  appName: process.env.BRAND_APP_NAME ?? "OfficeHub",
  logo: process.env.BRAND_LOGO_URL ?? "/logo.svg",
  primaryColor: process.env.BRAND_PRIMARY ?? "#000000",  // currently white-only, but exposed
  supportEmail: process.env.BRAND_SUPPORT ?? "support@office.local",
  legalUrl: process.env.BRAND_LEGAL ?? "",
} as const;
```

Replace hardcoded "OfficeHub" references throughout the codebase with `branding.appName`. (Sidebar, Header, login page, metadata in `layout.tsx`.)

### Theming hooks

Tailwind colors are derived from HSL CSS variables in `globals.css`. To allow per-tenant accent colors:
1. Convert primary color env vars to HSL at startup
2. Inject `<style>` in `<head>` with overrides for `--primary`, `--ring`
3. Cards / buttons pick them up automatically via `bg-primary`, `ring-primary`

For deep white-label (different fonts, different layouts), fork the repo — that's a product fork, not a config change.

---

## SSO (OIDC / SAML)

Auth.js v5 supports OIDC out of the box. Add the provider:

```typescript
// auth.ts
import Google from "next-auth/providers/google";
import AzureAD from "next-auth/providers/azure-ad";

providers: [
  Credentials({ ... existing ... }),
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    allowDangerousEmailAccountLinking: true,
  }),
  AzureAD({ ... }),
]
```

SAML is harder — Auth.js doesn't ship a SAML provider out-of-box. Options:
- Use a SAML→OIDC bridge (Workos, BoxyHQ Jackson)
- Roll your own with `samlify` (complex)

For B2B SSO, recommend **BoxyHQ Jackson** (OSS) bundled as an extra docker-compose service. Customers' IT teams configure SAML in Jackson; OfficeHub speaks OIDC to Jackson.

---

## Audit log

The `AuditLog` Prisma model exists but is unused. To wire it up:

1. In `src/app/dashboard/actions.ts`, after every mutation, write an audit row:
   ```typescript
   await db.auditLog.create({
     data: {
       userId: user.id,
       action: "project.update",
       entity: "Project",
       entityId: projectId,
       meta: { changes: parsed.data },
     },
   });
   ```
2. Add an admin-only `/dashboard/audit-log` page that queries with filters.
3. Set retention: cron job that archives rows >365 days into S3 / cold storage.

Required for SOC 2 / B2B enterprise sales.

---

## Backup & disaster recovery

Already covered in [`DEPLOY.md`](DEPLOY.md). For B2B-grade:
- Daily `pg_dump` to off-site storage (S3 / Backblaze)
- Quarterly restore drill (an untested backup is not a backup)
- Document RPO/RTO in your customer-facing SLA
- For multi-tenant: backup per tenant, label clearly

---

## Monitoring & alerting

OfficeHub ships `/api/health`. Beyond that, recommended stack:
- **Uptime:** UptimeRobot or Better Stack hitting `/api/health` every minute
- **Logs:** Loki + Grafana, OR ship to Datadog / New Relic
- **Errors:** Sentry (Next.js SDK; add `sentry.client.config.ts` + `sentry.server.config.ts`)
- **Metrics:** Prometheus exporter for Postgres (`postgres_exporter`) + a basic Next.js metrics middleware

None of these are bundled — they're per-customer decisions. Document in your runbook.

---

## License keys & per-feature gating

OfficeHub is MIT — fully free. If you want to offer a "Pro" edition with extras (advanced analytics, SAML SSO, audit log retention) gated by license:

1. Add a `LICENSE_KEY` env var (signed JWT or paddle.com license)
2. `src/lib/license.ts` validates the key on boot + every 24h
3. Pro features check `if (!isLicensed("audit-log")) return null;`
4. Build a separate "officehub-pro" fork that overrides specific files, OR
5. Keep Pro features behind feature flags in the main repo (simpler but means Pro code lives in the public repo)

For the second path, see [`config/features.ts`](../config/features.ts) — feature flags already support env-var-driven toggles.

---

## Compliance checklist (B2B sales)

| Item | Where to start |
|---|---|
| SOC 2 readiness | Audit log + access reviews + encryption at rest (`pgcrypto`) |
| GDPR (data export + delete) | REST endpoint per user: `GET /api/me/export`, `DELETE /api/me` |
| Single Sign-On | OIDC via Auth.js + (optional) SAML via BoxyHQ Jackson |
| Activity log | Wire `AuditLog` model + admin viewer |
| Role-based access control | Already in (`MEMBER` / `MANAGER` / `ADMIN` + per-project `members`) |
| HTTPS | Caddy On-Demand TLS or Cloudflare |
| Backups | Daily `pg_dump` + quarterly restore drill |
| Incident response runbook | Write `docs/INCIDENT-RUNBOOK.md` with on-call, escalation, post-mortem template |

OfficeHub doesn't ship as a "SOC 2 compliant product" — compliance is the operator's responsibility. But the architecture supports it.

---

## TL;DR

- **Default deploy:** single-tenant per office, Docker Compose, Caddy TLS. 10 minutes.
- **B2B install kit:** `scripts/setup.sh` does it in one command.
- **Multi-tenant SaaS:** real work. Database-per-tenant + subdomain routing + control-plane CLI. Plan 1-2 days extra.
- **White-label:** `config/branding.ts` + env-var-driven theme overrides.
- **SSO:** Auth.js OIDC for Google/Azure; BoxyHQ Jackson for SAML.
- **Audit log:** wire the existing `AuditLog` model into actions.
- **License gating:** feature flags in `config/features.ts` + license key validator if you want Pro tier.

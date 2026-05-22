# Deploy Runbook

## Prerequisites on the server

- Linux (Ubuntu 22.04+ or Debian 12+)
- Docker Engine 24+ and `docker compose` plugin
- ≥ 2 GB RAM, 10 GB disk
- A DNS A record pointing to the server if you want HTTPS via a reverse proxy

## First deploy

```bash
# On the server
git clone <your-fork-url> /opt/officehub
cd /opt/officehub

# Make a real .env
cp .env.example .env

# Generate the auth secret
sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env

# Set your public URL
sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"https://office.yourcompany.com\"|" .env

# Set a strong DB password (the compose file reads $POSTGRES_PASSWORD from your shell)
export POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"

# Build + start
docker compose up -d --build

# Wait for db health, then seed the first admin
sleep 20
docker compose exec app npx prisma db seed
```

App is live on `http://<server-ip>:3000`. The `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` are your initial login.

## Put it behind HTTPS (Caddy — easiest path)

Install Caddy on the host:
```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:
```caddy
office.yourcompany.com {
    reverse_proxy localhost:3000
    encode zstd gzip
}
```

```bash
sudo systemctl reload caddy
```

Caddy will auto-fetch and renew Let's Encrypt certificates. That's it.

## Put it behind HTTPS (nginx — if you already run nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name office.yourcompany.com;

    ssl_certificate     /etc/letsencrypt/live/office.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/office.yourcompany.com/privkey.pem;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade            $http_upgrade;
        proxy_set_header Connection         "upgrade";
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;
    }
}
```

## Database backup (cron)

`/etc/cron.daily/officehub-backup`:
```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/var/backups/officehub
mkdir -p "$BACKUP_DIR"
docker exec officehub-db pg_dump -U officehub officehub | gzip > "$BACKUP_DIR/officehub-$(date +%F).sql.gz"
find "$BACKUP_DIR" -type f -name 'officehub-*.sql.gz' -mtime +30 -delete
```

```bash
chmod +x /etc/cron.daily/officehub-backup
```

Test the restore path quarterly — a backup that hasn't been restored is not a backup.

## Restore

```bash
gunzip -c officehub-2026-05-22.sql.gz | docker exec -i officehub-db psql -U officehub -d officehub
```

## Upgrades

```bash
cd /opt/officehub
git pull
docker compose up -d --build
# Prisma migrate runs automatically as the container entrypoint.
```

## SQLite swap (for very small deployments — <10 users, dev/staging)

Postgres is the default. If you want zero infra dependencies:

1. Change `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
   And remove any `@db.Text` annotations (SQLite doesn't have a Text type).

2. Set in `.env`:
   ```
   DATABASE_URL="file:./prisma/dev.db"
   ```

3. Remove the `db` service from `docker-compose.yml` and mount `prisma/` as a volume on the `app` service so the SQLite file persists across redeploys.

4. Re-migrate:
   ```bash
   npx prisma migrate reset
   ```

## Reset everything (dangerous)

```bash
docker compose down -v   # -v drops the volumes — all data is gone
```

Never run this on a live deployment unless you have a verified backup in hand.

## Health check

`GET /api/health` returns `{ status: "ok", db: "ok" }` when the database is reachable, or HTTP 503 otherwise. Wire it to your monitoring or a simple cron-based uptime check.

## Common issues

- **`AUTH_SECRET missing`** on first start: re-run the `openssl rand` line, restart compose.
- **Migrations not applied**: the Dockerfile entrypoint runs `prisma migrate deploy`. If you need to migrate manually, `docker compose exec app npx prisma migrate deploy`.
- **Login loop / wrong-password every time**: `NEXTAUTH_URL` mismatch — set it to the exact URL you hit in the browser (scheme + host).
- **BlockNote editor shows "Loading editor…" forever**: an extension or strict CSP is blocking the editor. Disable strict CSP on the dashboard routes.

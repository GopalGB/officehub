#!/usr/bin/env bash
# OfficeHub — one-command bootstrap for fresh installs.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup.sh | bash
#   OR
#   ./scripts/setup.sh  (from inside an already-cloned repo)
#
# Env overrides:
#   OFFICEHUB_DIR   target directory (default: /opt/officehub if root, ~/officehub otherwise)
#   OFFICEHUB_URL   public URL (default: http://localhost:3000)
#   OFFICEHUB_PORT  app port (default: 3000)

set -euo pipefail

# ───── colors ─────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; BLU='\033[0;34m'; BLD='\033[1m'; NC='\033[0m'

say()  { printf "${BLU}▸${NC} %s\n" "$*"; }
ok()   { printf "${GRN}✓${NC} %s\n" "$*"; }
warn() { printf "${YLW}⚠${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }

# ───── preflight ─────
say "OfficeHub setup starting"

for cmd in docker git openssl curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Missing required command: $cmd"
    case "$cmd" in
      docker) err "  Install: https://docs.docker.com/engine/install/" ;;
      git)    err "  Install: sudo apt install git  (or brew install git)" ;;
    esac
    exit 1
  fi
done

# docker compose plugin OR docker-compose binary
COMPOSE=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  err "Neither 'docker compose' nor 'docker-compose' found. Install the docker compose plugin."
  exit 1
fi
ok "compose: $COMPOSE"

# ───── target directory ─────
DEFAULT_DIR="$HOME/officehub"
if [[ "$(id -u)" -eq 0 ]]; then DEFAULT_DIR="/opt/officehub"; fi
TARGET="${OFFICEHUB_DIR:-$DEFAULT_DIR}"

# ───── clone or use existing ─────
if [[ -d "$TARGET/.git" ]]; then
  say "Existing repo at $TARGET — pulling latest"
  ( cd "$TARGET" && git pull --ff-only )
elif [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null)" ]]; then
  err "$TARGET exists and is non-empty but not a git repo. Refusing to clobber."
  exit 1
else
  say "Cloning OfficeHub into $TARGET"
  git clone https://github.com/GopalGB/officehub.git "$TARGET"
fi
cd "$TARGET"
ok "in $TARGET"

# ───── .env ─────
if [[ ! -f .env ]]; then
  say "Creating .env from .env.example"
  cp .env.example .env

  AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
  POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
  SEED_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-12)

  # macOS uses BSD sed (-i ''), Linux uses GNU sed (-i). Use a temp file for portability.
  if [[ "$(uname)" == "Darwin" ]]; then SEDI=(sed -i ''); else SEDI=(sed -i); fi

  "${SEDI[@]}" "s|AUTH_SECRET=.*|AUTH_SECRET=\"$AUTH_SECRET\"|" .env
  "${SEDI[@]}" "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"${OFFICEHUB_URL:-http://localhost:${OFFICEHUB_PORT:-3000}}\"|" .env
  "${SEDI[@]}" "s|SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=\"$SEED_PASSWORD\"|" .env

  echo
  echo "POSTGRES_PASSWORD=\"$POSTGRES_PASSWORD\"" >> .env
  echo "OFFICEHUB_INITIAL_PASSWORD=\"$SEED_PASSWORD\"" >> .env

  ok ".env created with generated AUTH_SECRET, POSTGRES_PASSWORD, initial admin password"
else
  say ".env already exists — leaving it alone"
fi

# ───── build + start ─────
say "Building containers (this takes a few minutes the first time)"
export POSTGRES_PASSWORD
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d'"' -f2)
export POSTGRES_PASSWORD

$COMPOSE up -d --build

# ───── wait for db ─────
say "Waiting for Postgres to be healthy"
for i in {1..30}; do
  H=$(docker inspect -f '{{.State.Health.Status}}' officehub-db 2>/dev/null || echo "")
  if [[ "$H" == "healthy" ]]; then ok "db healthy"; break; fi
  if [[ $i -eq 30 ]]; then err "db never became healthy after 60s — check '$COMPOSE logs db'"; exit 1; fi
  sleep 2
done

# ───── seed admin ─────
say "Seeding admin account"
$COMPOSE exec -T app npx prisma db seed

# ───── done ─────
SEED_ADMIN_EMAIL=$(grep "^SEED_ADMIN_EMAIL=" .env | cut -d'"' -f2)
SEED_ADMIN_PASSWORD=$(grep "^SEED_ADMIN_PASSWORD=" .env | cut -d'"' -f2)
NEXTAUTH_URL=$(grep "^NEXTAUTH_URL=" .env | cut -d'"' -f2)

echo
printf "${BLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${BLD} OfficeHub is live${NC}\n"
printf "${BLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
echo
echo "URL:       $NEXTAUTH_URL"
echo "Email:     $SEED_ADMIN_EMAIL"
echo "Password:  $SEED_ADMIN_PASSWORD"
echo
echo "Next steps:"
echo "  1. Open $NEXTAUTH_URL in your browser"
echo "  2. Sign in with the credentials above"
echo "  3. Go to Settings → change the password"
echo "  4. Go to Team → add your colleagues (invite link or direct password)"
echo
echo "Docs:"
echo "  Architecture:  $TARGET/docs/ARCHITECTURE.md"
echo "  Deploy:        $TARGET/docs/DEPLOY.md"
echo "  Extending:     $TARGET/docs/EXTENDING.md"
echo "  Agents:        $TARGET/AGENTS.md"
echo
echo "Logs:    $COMPOSE logs -f app"
echo "Stop:    $COMPOSE stop"
echo "Reset:   $COMPOSE down -v   (⚠ wipes all data)"
echo
ok "Done."

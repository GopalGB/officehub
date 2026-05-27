#!/usr/bin/env bash
# OfficeHub — Docker-FREE native install for macOS and Linux.
#
# Requires only: Node 20+, git, openssl, and PostgreSQL (the script will
# install Postgres via brew/apt if missing).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.sh | bash
#   OR (inside an already-cloned repo):
#   ./scripts/setup-native.sh
#
# Env overrides:
#   OFFICEHUB_DIR     target directory (default: ~/officehub)
#   OFFICEHUB_PORT    app port (default: 3000)
#   OFFICEHUB_DB_USER Postgres user (default: officehub)
#   OFFICEHUB_DB_PASS Postgres password (default: random 16-char)

set -euo pipefail

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; BLU='\033[0;34m'; BLD='\033[1m'; NC='\033[0m'
say()  { printf "${BLU}▸${NC} %s\n" "$*"; }
ok()   { printf "${GRN}✓${NC} %s\n" "$*"; }
warn() { printf "${YLW}⚠${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }

say "OfficeHub native install (no Docker)"

# ───── OS detect ─────
case "$(uname -s)" in
  Darwin) OS=mac ;;
  Linux)  OS=linux ;;
  *)      err "Unsupported OS: $(uname -s). Native install works on macOS + Linux."; exit 1 ;;
esac
ok "OS: $OS"

# ───── git ─────
if ! command -v git >/dev/null 2>&1; then
  err "git not found. Install it:"
  [ "$OS" = mac ] && err "  brew install git" || err "  sudo apt install git"
  exit 1
fi

# ───── node ─────
if ! command -v node >/dev/null 2>&1; then
  err "Node.js not found. Install Node 20+:"
  if [ "$OS" = mac ]; then
    err "  brew install node@20  (or use nvm/fnm/volta)"
  else
    err "  https://nodejs.org/  (or: curl -fsSL https://fnm.vercel.app/install | bash)"
  fi
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node 20+ required, found $(node -v). Upgrade and re-run."
  exit 1
fi
ok "node: $(node -v)"

# ───── postgres ─────
if ! command -v psql >/dev/null 2>&1; then
  if [ "$OS" = mac ] && command -v brew >/dev/null 2>&1; then
    say "PostgreSQL not found — installing via Homebrew"
    brew install postgresql@16
    brew services start postgresql@16
    # Add to PATH for this session
    PG_PATH="$(brew --prefix)/opt/postgresql@16/bin"
    [ -d "$PG_PATH" ] && export PATH="$PG_PATH:$PATH"
  elif [ "$OS" = linux ]; then
    err "PostgreSQL not found. Install it first:"
    err "  Ubuntu/Debian:  sudo apt install postgresql-16 postgresql-contrib"
    err "  Fedora/RHEL:    sudo dnf install postgresql-server postgresql-contrib && sudo postgresql-setup --initdb && sudo systemctl enable --now postgresql"
    err "  Arch:           sudo pacman -S postgresql && sudo -u postgres initdb -D /var/lib/postgres/data && sudo systemctl enable --now postgresql"
    exit 1
  else
    err "PostgreSQL not found and brew not available. Install Postgres manually first: https://www.postgresql.org/download/"
    exit 1
  fi
fi
ok "postgres: $(psql --version | head -1)"

# ───── create DB user + database ─────
DB_USER="${OFFICEHUB_DB_USER:-officehub}"
DB_PASS="${OFFICEHUB_DB_PASS:-$(openssl rand -base64 16 | tr -d '/+=' | cut -c1-16)}"
DB_NAME="officehub"

say "Setting up database (user: $DB_USER, db: $DB_NAME)"

# On Mac with brew, your Unix user is the postgres superuser (no sudo needed).
# On Linux, the canonical way is `sudo -u postgres psql`.
if [ "$OS" = mac ]; then
  PSQL_AS_SUPER="psql -d postgres"
else
  PSQL_AS_SUPER="sudo -u postgres psql"
fi

# Idempotent — these all "fail" if user/db already exist; ignore that.
$PSQL_AS_SUPER -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
  || $PSQL_AS_SUPER -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;" >/dev/null

$PSQL_AS_SUPER -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || $PSQL_AS_SUPER -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" >/dev/null

# If user already existed, the password from .env (if present) is the source of truth.
# Otherwise reset it to the value we generated.
EXISTING_ENV_PASS=""
if [ -f "${OFFICEHUB_DIR:-$HOME/officehub}/.env" ]; then
  EXISTING_ENV_PASS=$(grep "^DATABASE_URL=" "${OFFICEHUB_DIR:-$HOME/officehub}/.env" 2>/dev/null \
    | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|' | head -1)
fi
if [ -n "$EXISTING_ENV_PASS" ]; then
  DB_PASS="$EXISTING_ENV_PASS"
  $PSQL_AS_SUPER -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
else
  $PSQL_AS_SUPER -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
fi
ok "database ready"

# ───── target directory ─────
TARGET="${OFFICEHUB_DIR:-$HOME/officehub}"

if [ -d "$TARGET/.git" ]; then
  say "Pulling latest in $TARGET"
  ( cd "$TARGET" && git pull --ff-only )
elif [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
  err "$TARGET exists and is non-empty but not a git repo. Refusing to clobber."
  exit 1
else
  say "Cloning into $TARGET"
  git clone https://github.com/GopalGB/officehub.git "$TARGET"
fi
cd "$TARGET"
ok "in $TARGET"

# ───── .env ─────
PORT="${OFFICEHUB_PORT:-3000}"

if [ ! -f .env ]; then
  cp .env.example .env
  AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
  SEED_PASS=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-12)

  if [ "$OS" = mac ]; then SEDI=(sed -i ''); else SEDI=(sed -i); fi
  "${SEDI[@]}" "s|AUTH_SECRET=.*|AUTH_SECRET=\"$AUTH_SECRET\"|" .env
  "${SEDI[@]}" "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public\"|" .env
  "${SEDI[@]}" "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"http://localhost:$PORT\"|" .env
  "${SEDI[@]}" "s|SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=\"$SEED_PASS\"|" .env

  ok ".env created"
else
  say ".env already exists — leaving it alone"
fi

# ───── install + migrate + seed ─────
say "Installing dependencies (npm install)"
npm install --no-audit --no-fund 2>&1 | tail -5

say "Generating Prisma client"
npx prisma generate >/dev/null

say "Pushing schema"
npx prisma db push --accept-data-loss >/dev/null 2>&1

say "Seeding admin + starter tags"
npm run db:seed 2>&1 | tail -3

# ───── done ─────
SEED_EMAIL=$(grep "^SEED_ADMIN_EMAIL=" .env | cut -d'"' -f2)
SEED_PASSWORD=$(grep "^SEED_ADMIN_PASSWORD=" .env | cut -d'"' -f2)

echo
printf "${BLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${BLD} OfficeHub installed (no Docker)${NC}\n"
printf "${BLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
echo
echo "Start the app:"
echo "  cd $TARGET"
echo "  npm run dev"
echo
echo "Then open:  http://localhost:$PORT"
echo
echo "Email:      $SEED_EMAIL"
echo "Password:   $SEED_PASSWORD"
echo
echo "Next steps:"
echo "  1. Sign in → Settings → change the password"
echo "  2. Team → invite teammates (invite link OR set password)"
echo
echo "Production-grade run (no terminal needed once started):"
if [ "$OS" = mac ]; then
  echo "  Add to ~/Library/LaunchAgents/officehub.plist (see docs/DEPLOY.md)"
else
  echo "  Use systemd (sample unit in docs/DEPLOY.md)"
fi
echo
echo "Stop Postgres if you want:"
if [ "$OS" = mac ]; then
  echo "  brew services stop postgresql@16"
else
  echo "  sudo systemctl stop postgresql"
fi
echo
ok "Done."

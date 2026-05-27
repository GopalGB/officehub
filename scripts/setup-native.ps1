# OfficeHub - Docker-FREE native install for Windows.
#
# Requires only: Node.js 20+, git, PostgreSQL.
# Script will check for them and tell you how to install if missing.
#
# Usage (in PowerShell, NOT classic cmd):
#   irm https://raw.githubusercontent.com/GopalGB/officehub/main/scripts/setup-native.ps1 | iex
#
#   OR inside an already-cloned repo:
#   .\scripts\setup-native.ps1
#
# Env overrides:
#   $env:OFFICEHUB_DIR    - target directory (default: $HOME\officehub)
#   $env:OFFICEHUB_PORT   - app port (default: 3000)

$ErrorActionPreference = "Stop"

function Say($msg) { Write-Host "▸ $msg" -ForegroundColor Blue }
function Ok($msg)  { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg){ Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Err($msg) { Write-Host "✗ $msg" -ForegroundColor Red; }

Say "OfficeHub native install for Windows (no Docker)"

# ─── PowerShell version (need 5.1+) ───
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Err "PowerShell 5+ required. You have $($PSVersionTable.PSVersion). Update via Windows Update."
    exit 1
}

# ─── Check git ───
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Err "git not found. Install: winget install Git.Git"
    Err "  or download from https://git-scm.com/download/win"
    exit 1
}

# ─── Check Node 20+ ───
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js not found. Install Node 20+:"
    Err "  winget install OpenJS.NodeJS.LTS"
    Err "  or download from https://nodejs.org/"
    exit 1
}
$nodeVer = (node -v) -replace "v","" -split "\."
$nodeMajor = [int]$nodeVer[0]
if ($nodeMajor -lt 20) {
    Err "Node 20+ required, found v$($nodeVer -join '.'). Upgrade and re-run."
    exit 1
}
Ok "node: v$($nodeVer -join '.')"

# ─── Check PostgreSQL ───
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    # Try common Postgres install paths on Windows
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\16\bin",
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\PostgreSQL\14\bin"
    )
    foreach ($p in $pgPaths) {
        if (Test-Path "$p\psql.exe") {
            $env:Path = "$p;$env:Path"
            $psql = Get-Command psql -ErrorAction SilentlyContinue
            if ($psql) { Ok "Found Postgres at $p"; break }
        }
    }
}
if (-not $psql) {
    Err "PostgreSQL not found. Install it:"
    Err "  winget install PostgreSQL.PostgreSQL.16"
    Err "  or download installer from https://www.postgresql.org/download/windows/"
    Err ""
    Err "After install, re-run this script. When the installer asks for a"
    Err "superuser password, write it down — you'll need it once below."
    exit 1
}
Ok "postgres: $((psql --version) -split '`n' | Select-Object -First 1)"

# ─── DB setup ───
$dbUser = if ($env:OFFICEHUB_DB_USER) { $env:OFFICEHUB_DB_USER } else { "officehub" }
$dbName = "officehub"

# Generate password if not provided
if ($env:OFFICEHUB_DB_PASS) {
    $dbPass = $env:OFFICEHUB_DB_PASS
} else {
    $bytes = New-Object byte[] 12
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $dbPass = [Convert]::ToBase64String($bytes) -replace "[/+=]",""
    $dbPass = $dbPass.Substring(0, [Math]::Min(16, $dbPass.Length))
}

Say "Setting up database (user: $dbUser, db: $dbName)"
Say "If prompted for a password, enter the PostgreSQL superuser password you set during install."

# On Windows, default superuser is 'postgres'. Connect to default 'postgres' DB.
$env:PGCLIENTENCODING = "UTF8"

# Check if our user exists
$userExists = (psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$dbUser'" 2>$null) -eq "1"
if (-not $userExists) {
    psql -U postgres -d postgres -c "CREATE USER $dbUser WITH PASSWORD '$dbPass' CREATEDB;" | Out-Null
} else {
    psql -U postgres -d postgres -c "ALTER USER $dbUser WITH PASSWORD '$dbPass';" | Out-Null
}

# Check if our DB exists
$dbExists = (psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>$null) -eq "1"
if (-not $dbExists) {
    psql -U postgres -d postgres -c "CREATE DATABASE $dbName OWNER $dbUser;" | Out-Null
}
Ok "database ready"

# ─── Target directory ───
$target = if ($env:OFFICEHUB_DIR) { $env:OFFICEHUB_DIR } else { "$HOME\officehub" }

if (Test-Path "$target\.git") {
    Say "Pulling latest in $target"
    Push-Location $target
    git pull --ff-only | Out-Null
    Pop-Location
} elseif ((Test-Path $target) -and (Get-ChildItem $target -Force | Where-Object { $_.Name -ne '.' })) {
    Err "$target exists and is non-empty but not a git repo. Refusing to clobber."
    exit 1
} else {
    Say "Cloning into $target"
    git clone https://github.com/GopalGB/officehub.git $target
}
Set-Location $target
Ok "in $target"

# ─── .env ───
$port = if ($env:OFFICEHUB_PORT) { $env:OFFICEHUB_PORT } else { "3000" }

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env

    # Generate AUTH_SECRET (32-byte base64)
    $secretBytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secretBytes)
    $authSecret = [Convert]::ToBase64String($secretBytes)

    # Generate seed password
    $seedBytes = New-Object byte[] 9
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($seedBytes)
    $seedPass = [Convert]::ToBase64String($seedBytes) -replace "[/+=]",""

    # Patch .env
    (Get-Content .env) `
        -replace '^AUTH_SECRET=.*', "AUTH_SECRET=`"$authSecret`"" `
        -replace '^DATABASE_URL=.*', "DATABASE_URL=`"postgresql://${dbUser}:${dbPass}@localhost:5432/${dbName}?schema=public`"" `
        -replace '^NEXTAUTH_URL=.*', "NEXTAUTH_URL=`"http://localhost:$port`"" `
        -replace '^SEED_ADMIN_PASSWORD=.*', "SEED_ADMIN_PASSWORD=`"$seedPass`"" `
        | Set-Content .env

    Ok ".env created"
} else {
    Say ".env already exists - leaving it alone"
}

# ─── Install + migrate + seed ───
Say "Installing dependencies (npm install)"
npm install --no-audit --no-fund 2>&1 | Select-Object -Last 5

Say "Generating Prisma client"
npx prisma generate | Out-Null

Say "Pushing schema"
npx prisma db push --accept-data-loss 2>&1 | Out-Null

Say "Seeding admin + starter tags"
npm run db:seed 2>&1 | Select-Object -Last 3

# ─── Done ───
$envContent = Get-Content .env
$seedEmail = ($envContent | Where-Object { $_ -match '^SEED_ADMIN_EMAIL=' }) -replace '^SEED_ADMIN_EMAIL="?([^"]*)"?$', '$1'
$seedPasswordFinal = ($envContent | Where-Object { $_ -match '^SEED_ADMIN_PASSWORD=' }) -replace '^SEED_ADMIN_PASSWORD="?([^"]*)"?$', '$1'

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
Write-Host " OfficeHub installed (no Docker, Windows native)" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor White
Write-Host ""
Write-Host "Start the app:"
Write-Host "  cd $target"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open:  http://localhost:$port"
Write-Host ""
Write-Host "Email:     $seedEmail"
Write-Host "Password:  $seedPasswordFinal"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Sign in -> Settings -> change the password"
Write-Host "  2. Team -> invite teammates (link OR set password)"
Write-Host ""
Write-Host "Run as Windows service later: see docs/DEPLOY.md"
Write-Host "Stop Postgres (optional):  net stop postgresql-x64-16"
Write-Host ""
Ok "Done."

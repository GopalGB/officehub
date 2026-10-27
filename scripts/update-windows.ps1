# Runs in a normal Windows PowerShell 5.1 user session.
# No installers, elevation, services, firewall, PATH, certificate-store or policy changes.
param(
    [string]$AppDir = (Get-Location).Path,
    [string]$ListenIp = $env:OFFICEHUB_LISTEN_IP,
    [int]$ListenPort = 8599
)
$ErrorActionPreference = "Stop"
$PreviousNodeOptions = $env:NODE_OPTIONS
$PreviousNodeEnv = $env:NODE_ENV
$PreviousDatabaseUrl = $env:DATABASE_URL

function Run-Checked {
    param([string]$Program, [string[]]$CommandArgs)
    & $Program @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "$Program failed. Upgrade stopped; review the error above." }
}
function Write-Utf8 {
    param([string]$Path, [string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}
try {
    Set-Location -LiteralPath $AppDir
    if (-not (Test-Path .\package.json) -or -not (Test-Path .\.git) -or -not (Test-Path .\.env)) {
        throw "Open the existing OfficeHub repository with its .env file first. This updater does not create a database or replace login settings."
    }
    foreach ($Program in @("node.exe", "npm.cmd", "npx.cmd", "git.exe")) {
        if (-not (Get-Command $Program -ErrorAction SilentlyContinue)) { throw "$Program is missing. Use your company-approved installation." }
    }
    $Branch = (& git.exe branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $Branch -ne "main") { throw "Switch this checkout to main before upgrading. Your files have been preserved." }
    $Origin = (& git.exe remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0 -or $Origin -notmatch '^(https://github\.com/GopalGB/officehub(?:\.git)?/?|git@github\.com:GopalGB/officehub(?:\.git)?)$') {
        throw "The origin remote must be the official GopalGB/officehub repository. No remote settings were changed."
    }
    if ($ListenPort -lt 1 -or $ListenPort -gt 65535) { throw "Choose a valid app port." }
    if (Get-NetTCPConnection -State Listen -LocalPort $ListenPort -ErrorAction SilentlyContinue) {
        throw "Port $ListenPort is in use. Stop the existing OfficeHub terminal with Ctrl+C before updating. No process was stopped automatically."
    }
    $AppDir = (Get-Location).Path
    $BackupDir = Join-Path $env:LOCALAPPDATA ("CatalystWorkspace\Backups\" + (Get-Date -Format "yyyyMMdd-HHmmss-fff"))
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Copy-Item -LiteralPath .\.env -Destination (Join-Path $BackupDir ".env")
    if (Test-Path .\logo.png) { Copy-Item -LiteralPath .\logo.png -Destination (Join-Path $BackupDir "logo.png") }

    # Preserve the known Windows-only standalone fix from the earlier setup.
    # Any other tracked edit stops the update; nothing is stashed or discarded.
    $Status = @(& git.exe status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect local changes." }
    if ($Status.Count -gt 0) {
        $Changed = @(& git.exe diff --name-only HEAD)
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect changed files." }
        if ($Changed.Count -ne 1 -or $Changed[0] -ne "next.config.ts") { throw "Local tracked changes found. Commit or review them before updating. Your files were preserved." }
        # Base64 avoids PowerShell 5.1 native-output code-page changes to UTF-8 comments.
        $HeadBase64 = & node.exe -p "require('node:child_process').execFileSync('git.exe', ['show', 'HEAD:next.config.ts']).toString('base64')"
        if ($LASTEXITCODE -ne 0) { throw "Could not read the original Next.js configuration." }
        $HeadConfig = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(([string]$HeadBase64).Trim()))
        $LocalConfig = [System.IO.File]::ReadAllText((Join-Path $AppDir "next.config.ts"))
        $ExpectedConfig = $HeadConfig.Replace('process.env.NODE_ENV === "production" ?', 'process.env.NODE_ENV === "production" && process.platform !== "win32" ?')
        if ($LocalConfig.Replace("`r`n", "`n").Trim() -ne $ExpectedConfig.Trim()) { throw "next.config.ts has custom edits. Review them before updating; no custom configuration was replaced." }
        Copy-Item -LiteralPath .\next.config.ts -Destination (Join-Path $BackupDir "next.config.ts")
        Run-Checked "git.exe" @("restore", "--source=HEAD", "--staged", "--worktree", "--", "next.config.ts")
    }
    Write-Host "Updating from GopalGB/officehub main. Backups: $BackupDir"
    Run-Checked "git.exe" @("fetch", "origin", "main")
    Run-Checked "git.exe" @("merge", "--ff-only", "FETCH_HEAD")

    # Use already trusted Windows certificates for this process, when supported.
    $SystemCa = & node.exe -p "process.allowedNodeEnvironmentFlags.has('--use-system-ca')"
    if ($LASTEXITCODE -ne 0) { throw "Could not check Node.js." }
    if ($SystemCa -eq "true" -and $env:NODE_OPTIONS -notmatch '(^|\s)--use-system-ca(\s|$)') {
        $env:NODE_OPTIONS = (([string]$PreviousNodeOptions) + " --use-system-ca").Trim()
    }
    $env:NODE_ENV = "production"
    # Make this repo's preserved .env authoritative, rather than an old shell value.
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    [string[]]$LocalIps = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" }).IPAddress
    if ([string]::IsNullOrWhiteSpace($ListenIp)) {
        $ConfiguredHost = & node.exe --env-file=.env -e "const u = process.env.AUTH_URL || process.env.NEXTAUTH_URL; if (u) process.stdout.write(new URL(u).hostname)"
        if ($LASTEXITCODE -ne 0) { throw "Could not read the configured app URL." }
        if ($ConfiguredHost -in $LocalIps) { $ListenIp = $ConfiguredHost }
        elseif ($LocalIps.Count -eq 1) { $ListenIp = $LocalIps[0] }
        else { throw "More than one network IP was found. Set `$env:OFFICEHUB_LISTEN_IP to the intended server IPv4 address and rerun." }
    }
    if ($ListenIp -notin $LocalIps) { throw "The selected IP is not assigned to this server. Check Get-NetIPAddress -AddressFamily IPv4." }

    # Find the existing PostgreSQL backup utility without modifying PATH.
    $PgDump = $env:OFFICEHUB_PG_DUMP
    if ([string]::IsNullOrWhiteSpace($PgDump)) {
        $FoundDump = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
        if ($FoundDump) { $PgDump = $FoundDump.Source }
    }
    if ([string]::IsNullOrWhiteSpace($PgDump)) {
        foreach ($Version in @(19, 18, 17, 16, 15, 14)) {
            $Candidate = Join-Path $env:ProgramFiles "PostgreSQL\$Version\bin\pg_dump.exe"
            if (Test-Path -LiteralPath $Candidate) { $PgDump = $Candidate; break }
        }
    }
    if ([string]::IsNullOrWhiteSpace($PgDump) -or -not (Test-Path -LiteralPath $PgDump)) {
        throw "pg_dump.exe was not found. Set `$env:OFFICEHUB_PG_DUMP to the existing PostgreSQL bin\pg_dump.exe path and rerun. No database changes were made."
    }
    Run-Checked "node.exe" @("--env-file=.env", "scripts/backup-db.mjs", $PgDump, (Join-Path $BackupDir "tracker.dump"))
    Run-Checked "npm.cmd" @("ci", "--include=dev")
    # Never pass --accept-data-loss or --force-reset. Prisma stops on unsafe changes.
    Run-Checked "npx.cmd" @("prisma", "db", "push")
    Run-Checked "npm.cmd" @("run", "build")

    $AppUrl = "http://${ListenIp}:${ListenPort}"
    $Lines = @(Get-Content -LiteralPath .\.env)
    foreach ($Key in @("NEXTAUTH_URL", "AUTH_URL")) {
        $Pattern = '^\s*' + [regex]::Escape($Key) + '\s*=.*$'
        $NewLine = $Key + '="' + $AppUrl + '"'
        if ($Lines -match $Pattern) { $Lines = $Lines -replace $Pattern, $NewLine } else { $Lines += $NewLine }
    }
    Write-Utf8 (Join-Path $AppDir ".env") ($Lines -join [Environment]::NewLine)
    Write-Host "OfficeHub updated. Open $AppUrl" -ForegroundColor Green
    Write-Host "Existing database, users, passwords, auth secret and logo preserved. Keep this terminal open."
    Run-Checked "npm.cmd" @("start", "--", "--hostname", $ListenIp, "--port", [string]$ListenPort)
} finally {
    if ($null -eq $PreviousNodeOptions) { Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue } else { $env:NODE_OPTIONS = $PreviousNodeOptions }
    if ($null -eq $PreviousNodeEnv) { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue } else { $env:NODE_ENV = $PreviousNodeEnv }
    if ($null -eq $PreviousDatabaseUrl) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_URL = $PreviousDatabaseUrl }
}

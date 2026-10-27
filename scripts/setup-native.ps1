# OfficeHub Windows user-account entry point. Uses an existing PostgreSQL database.
# Configure .env first as described in docs/WINDOWS.md.
param(
    [string]$AppDir = $(if ($env:OFFICEHUB_DIR) { $env:OFFICEHUB_DIR } else { (Get-Location).Path }),
    [string]$ListenIp = $env:OFFICEHUB_LISTEN_IP,
    [int]$ListenPort = 8599
)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $AppDir
if (-not (Test-Path .\.git) -or -not (Test-Path .\.env)) {
    throw "Open the OfficeHub repository and configure its .env first. See docs/WINDOWS.md. This script does not install software, create database roles, or change machine settings."
}
$UpdaterPath = Join-Path (Get-Location).Path "scripts\update-windows.ps1"
if (-not (Test-Path -LiteralPath $UpdaterPath)) { throw "The Windows updater is missing. Pull main from GopalGB/officehub first." }
# Loading the local script as text also works when .ps1 files cannot be launched.
# It does not change Windows execution policy.
$Updater = [scriptblock]::Create([System.IO.File]::ReadAllText($UpdaterPath))
& $Updater -AppDir (Get-Location).Path -ListenIp $ListenIp -ListenPort $ListenPort

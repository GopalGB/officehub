# Exercises the updater with a real temporary Git repository and simulated
# Windows network/native commands. Does not install software or touch a live DB.
# Run in a separate PowerShell process: pwsh -NoProfile -File tests/windows/updater.Tests.ps1
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$Root = Join-Path ([IO.Path]::GetTempPath()) ('officehub-updater-test-' + [guid]::NewGuid().ToString('N'))
$Remote = Join-Path $Root 'remote.git'
$Source = Join-Path $Root 'source'
$Target = Join-Path $Root 'checkout'
$TracePath = Join-Path $Root 'commands.txt'
$RealGit = (Get-Command git).Source
New-Item -ItemType Directory -Path $Root, $Source | Out-Null
& $RealGit init --bare $Remote *> $null
& $RealGit -C $Source init -b main *> $null
& $RealGit -C $Source config user.email 'test@officehub.invalid'
& $RealGit -C $Source config user.name 'Updater test'
Set-Content (Join-Path $Source '.gitignore') ".env`nlogo.png"
Set-Content (Join-Path $Source 'package.json') '{"name":"updater-test"}'
$OldConfig = [IO.File]::ReadAllText((Join-Path $Repo 'next.config.ts')).Replace('process.env.NODE_ENV === "production" && process.platform !== "win32" ?', 'process.env.NODE_ENV === "production" ?')
[IO.File]::WriteAllText((Join-Path $Source 'next.config.ts'), $OldConfig)
& $RealGit -C $Source add .
& $RealGit -C $Source commit -m 'Existing checkout' *> $null
& $RealGit -C $Source remote add origin $Remote
& $RealGit -C $Source push -u origin main *> $null
& $RealGit clone --branch main $Remote $Target *> $null
New-Item -ItemType Directory -Path (Join-Path $Source 'scripts') | Out-Null
Copy-Item "$Repo/scripts/update-windows.ps1", "$Repo/scripts/backup-db.mjs" (Join-Path $Source 'scripts')
Copy-Item "$Repo/next.config.ts" (Join-Path $Source 'next.config.ts')
& $RealGit -C $Source add .
& $RealGit -C $Source commit -m 'Workspace upgrade' *> $null
& $RealGit -C $Source push *> $null
$BrokenDash = ([string][char]0x00E2) + ([string][char]0x20AC) + ([string][char]0x201D)
$Dash = [string][char]0x2014
$WindowsConfig = $OldConfig.Replace('process.env.NODE_ENV === "production" ?', 'process.env.NODE_ENV === "production" && process.platform !== "win32" ?')
# Reproduce the reported PowerShell 5.1 save: the intended Windows guard plus
# mojibake in the comment, CRLF line endings, and an optional UTF-8 BOM.
$WindowsConfig = $WindowsConfig.Replace($Dash, $BrokenDash).Replace("`r`n", "`n").Replace("`n", "`r`n")
[IO.File]::WriteAllText((Join-Path $Target 'next.config.ts'), $WindowsConfig, (New-Object System.Text.UTF8Encoding($true)))
$EnvText = "DATABASE_URL=`"postgresql://test@test.invalid/tracker?schema=public`"`nAUTH_SECRET=`"unchanged-secret`"`nNEXTAUTH_URL=`"http://10.5.64.77:8599`"`nSEED_ADMIN_PASSWORD=`"unchanged-login`""
[IO.File]::WriteAllText((Join-Path $Target '.env'), $EnvText)
[IO.File]::WriteAllText((Join-Path $Target 'logo.png'), 'logo bytes preserved')
$env:LOCALAPPDATA = Join-Path $Root 'local'
$env:OFFICEHUB_PG_DUMP = Join-Path $Root 'pg_dump.exe'
Set-Content $env:OFFICEHUB_PG_DUMP 'simulation only'
$env:NODE_OPTIONS = '--original-option'
$env:NODE_ENV = 'before-update'
$env:DATABASE_URL = 'ambient-value-preserved'
$script:FailBuild = $false
$script:PostgresServicePath = $null
function global:Get-NetTCPConnection { param($State, $LocalPort, $ErrorAction) }
function global:Get-NetIPAddress { param($AddressFamily) [pscustomobject]@{IPAddress='10.5.64.77'} }
function global:Get-CimInstance {
 param($ClassName, $Filter, $ErrorAction)
 if ($script:PostgresServicePath) { [pscustomobject]@{ PathName=$script:PostgresServicePath; State='Running' } }
}
function global:git.exe {
 param([Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs)
 Add-Content $TracePath ('git ' + ($CommandArgs -join ' '))
 if ($CommandArgs[0] -eq 'remote' -and $CommandArgs[1] -eq 'get-url') { $global:LASTEXITCODE=0; 'https://github.com/GopalGB/officehub.git'; return }
 & $RealGit @CommandArgs
 $global:LASTEXITCODE = $LASTEXITCODE
}
function global:node.exe {
 $CommandArgs = @($args)
 Add-Content $TracePath ('node ' + ($CommandArgs -join ' '))
 $global:LASTEXITCODE = 0
 if ($CommandArgs[0] -eq '-p' -and $CommandArgs[1].Contains('execFileSync')) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($OldConfig)) }
 elseif ($CommandArgs[0] -eq '-p') { 'true' }
 elseif ($CommandArgs -contains 'scripts/backup-db.mjs') { [IO.File]::WriteAllText($CommandArgs[-1], ('backup simulation' * 20)) }
 else { 'localhost' }
}
function global:npm.cmd {
 param([Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs)
 Add-Content $TracePath ('npm ' + ($CommandArgs -join ' '))
 if ($script:FailBuild -and $CommandArgs[0] -eq 'run') { $global:LASTEXITCODE=1 } else { $global:LASTEXITCODE=0 }
}
function global:npx.cmd {
 param([Parameter(ValueFromRemainingArguments=$true)][string[]]$CommandArgs)
 Add-Content $TracePath ('npx ' + ($CommandArgs -join ' ')); $global:LASTEXITCODE=0
}
Set-Location $Target
$GitSettings = [IO.File]::ReadAllText((Join-Path $Target '.git/config'))
$Updater = [scriptblock]::Create([IO.File]::ReadAllText("$Repo/scripts/update-windows.ps1"))
& $Updater -AppDir $Target
if ($env:NODE_OPTIONS -ne '--original-option' -or $env:NODE_ENV -ne 'before-update' -or $env:DATABASE_URL -ne 'ambient-value-preserved') { throw 'Environment was not restored' }
$AfterEnv = [IO.File]::ReadAllText((Join-Path $Target '.env'))
if (-not $AfterEnv.Contains('AUTH_SECRET="unchanged-secret"') -or -not $AfterEnv.Contains('SEED_ADMIN_PASSWORD="unchanged-login"')) { throw 'Secrets were changed' }
if ([IO.File]::ReadAllText((Join-Path $Target 'logo.png')) -ne 'logo bytes preserved') { throw 'Logo was changed' }
$Commands = [IO.File]::ReadAllText($TracePath)
if ($Commands.IndexOf('scripts/backup-db.mjs') -gt $Commands.IndexOf('npx prisma db push')) { throw 'Schema ran before backup' }
if (-not $Commands.Contains('npm start -- --hostname 10.5.64.77 --port 8599')) { throw 'Wrong app binding' }
if ($Commands.Contains('--accept-data-loss')) { throw 'Unsafe schema flag' }
if (-not $Commands.Contains('git -c maintenance.auto=false -c gc.auto=0 fetch --no-auto-gc origin main')) { throw 'Fetch may trigger automatic Git maintenance' }
if (-not $Commands.Contains('git -c maintenance.auto=false -c gc.auto=0 merge --ff-only FETCH_HEAD')) { throw 'Merge may trigger automatic Git maintenance' }
if ([IO.File]::ReadAllText((Join-Path $Target '.git/config')) -cne $GitSettings) { throw 'Persistent Git settings changed' }
$SavedConfig = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'CatalystWorkspace/Backups') -Recurse -Filter 'next.config.ts' | Select-Object -First 1
if (-not $SavedConfig -or [IO.File]::ReadAllText($SavedConfig.FullName) -cne $WindowsConfig) { throw 'The original Windows configuration was not preserved exactly' }
'PASS updater: recognizes Windows comment encoding, CRLF and BOM; original config, logo and secrets preserved; backup before schema; port 8599'
'PASS updater: skips automatic maintenance during fetch and merge without changing persistent Git settings'
# Find the utility next to a registered service in a custom Program Files path.
# This reproduces D:\Program Files\PostgreSQL\18 rather than C:\Program Files.
$OriginalDumpOverride = $env:OFFICEHUB_PG_DUMP
$CustomBin = Join-Path $Root 'Program Files/PostgreSQL/18/bin'
New-Item -ItemType Directory -Path $CustomBin | Out-Null
$CustomDump = Join-Path $CustomBin 'pg_dump.exe'
Set-Content $CustomDump 'simulated installed backup utility'
$script:PostgresServicePath = '"' + (Join-Path $CustomBin 'pg_ctl.exe') + '" runservice -N "postgresql-x64-18"'
try {
    Remove-Item Env:OFFICEHUB_PG_DUMP -ErrorAction SilentlyContinue
    Clear-Content $TracePath
    & $Updater -AppDir $Target
    if (-not [IO.File]::ReadAllText($TracePath).Contains($CustomDump)) { throw 'Custom PostgreSQL service path was not used for backup' }
} finally {
    $env:OFFICEHUB_PG_DUMP = $OriginalDumpOverride
    $script:PostgresServicePath = $null
}
'PASS updater: finds pg_dump beside the PostgreSQL service in a custom drive/path with spaces'
# Genuine settings must be rejected even if the file also has the known comment
# artifact. Comparison is case-sensitive, and string values are never repaired.
$CleanConfig = [IO.File]::ReadAllText((Join-Path $Target 'next.config.ts'))
foreach ($CustomConfig in @(
    $CleanConfig.Replace('bodySizeLimit: "5mb"', 'bodySizeLimit: "10mb"'),
    $CleanConfig.Replace('reactStrictMode: true', 'reactStrictMode: false'),
    $CleanConfig.Replace('reactStrictMode', 'ReactStrictMode'),
    $CleanConfig.Replace('bodySizeLimit: "5mb"', ('bodySizeLimit: "' + $BrokenDash + '"'))
)) {
    $CustomConfig = $CustomConfig.Replace($Dash, $BrokenDash)
    [IO.File]::WriteAllText((Join-Path $Target 'next.config.ts'), $CustomConfig)
    Clear-Content $TracePath
    $Failed = $false
    try { & $Updater -AppDir $Target } catch { $Failed = $_.Exception.Message.Contains('next.config.ts has custom edits') }
    if (-not $Failed -or [IO.File]::ReadAllText((Join-Path $Target 'next.config.ts')) -cne $CustomConfig) { throw 'Custom configuration was not protected' }
    if ([IO.File]::ReadAllText($TracePath).Contains('npx prisma db push')) { throw 'Schema changes ran despite custom configuration' }
}
& $RealGit -C $Target restore next.config.ts
'PASS updater: preserves real settings, case changes, and string values; no database changes when blocked'
# Unknown tracked edits must stop and remain intact.
[IO.File]::AppendAllText((Join-Path $Target 'package.json'), 'custom change')
$Failed = $false
try { & $Updater -AppDir $Target } catch { $Failed = $_.Exception.Message.Contains('Local tracked changes') }
if (-not $Failed -or -not ([IO.File]::ReadAllText((Join-Path $Target 'package.json'))).Contains('custom change')) { throw 'Local edits were not protected' }
'PASS updater: refuses unknown tracked edits without discarding them'
& $RealGit -C $Target restore package.json
# A native-command failure must stop before starting the app and restore process state.
Clear-Content $TracePath
$script:FailBuild=$true
$Failed=$false
try { & $Updater -AppDir $Target } catch { $Failed=$_.Exception.Message.Contains('npm.cmd failed') }
if (-not $Failed -or ([IO.File]::ReadAllText($TracePath)).Contains('npm start') -or $env:NODE_OPTIONS -ne '--original-option') { throw 'Failure was not handled safely' }
'PASS updater: build failure stops startup and restores environment'

Set-Location $Repo
Remove-Item -LiteralPath $Root -Recurse -Force
# The failure above was expected and asserted. Do not pass the simulated native
# exit status to GitHub Actions' PowerShell wrapper after the suite succeeds.
$global:LASTEXITCODE = 0

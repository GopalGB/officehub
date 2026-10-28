# Windows office-server updates (normal user, no Docker)

Use an existing, company-approved Node.js 20.19+ or 22/24 LTS, Git, and PostgreSQL installation. No Windows administrator rights are needed. The app's database must already exist. PostgreSQL's existing database permissions still apply.

## Update the running installation

Stop the OfficeHub terminal with **Ctrl+C**, then run this block in a normal Windows PowerShell window. It obtains the updater from the official repository before updating the checkout, so it also works on the previous release:

```powershell
Set-Location "D:\Gopal\Tracker_BI\officehub"
$ErrorActionPreference = "Stop"
git.exe -c maintenance.auto=false -c gc.auto=0 fetch --no-auto-gc https://github.com/GopalGB/officehub.git main
if ($LASTEXITCODE -ne 0) { throw "GitHub fetch failed. Stop here." }
$UpdaterText = git.exe show "FETCH_HEAD:scripts/update-windows.ps1"
if ($LASTEXITCODE -ne 0) { throw "Could not read the official updater. Stop here." }
Invoke-Expression ($UpdaterText -join [Environment]::NewLine)
```

The updater keeps port **8599**. It uses the configured app IP if that address still belongs to the server; otherwise, a single available network IPv4 address is selected. With the current address, the application URL is **http://10.5.64.77:8599**. Keep the terminal open. Refresh existing browser tabs after the update.

If the server has several IP addresses, select the intended address for this PowerShell session before running the block:

```powershell
$env:OFFICEHUB_LISTEN_IP = "10.5.64.77"
```

The updater:

1. Checks that the checkout is on `main`, the origin is `GopalGB/officehub`, and the target app port is free. It does not stop arbitrary processes.
2. Copies `.env`, the optional root `logo.png`, and the known earlier Windows configuration adjustment into `%LOCALAPPDATA%\CatalystWorkspace\Backups\<timestamp>`.
3. Refuses unexpected tracked edits. The earlier `next.config.ts` Windows standalone fix is backed up and reconciled automatically, since that fix is now in main. Its comparison tolerates Windows line endings and the known PowerShell 5.1 garbled-dash artifact in full-line comments. Setting names and string values are compared case-sensitively and are never repaired or ignored.
4. Fetches main and fast-forwards. Both commands skip automatic Git maintenance to avoid Windows prompts about locked pack files. These options apply only to the commands and do not change persistent Git settings. It does not force-reset, overwrite custom code, or change remotes.
5. Finds the existing `pg_dump.exe` using an explicit override, PATH, registered PostgreSQL services/installations, or standard product folders, then backs up the configured database to `tracker.dump`. Custom installation drives and versions are supported. The filename is just a backup name; the connection comes from your `.env`. Credentials are passed only in the backup child process environment.
6. Runs `npm ci --include=dev`, `prisma db push` **without** data-loss or reset flags, and the production build. Native command failures stop the update.
7. Updates only the app's `AUTH_URL` / `NEXTAUTH_URL` lines and starts on the chosen server IP and port. Existing users, passwords, auth secret, project IDs, and logo are preserved. Seeding is not repeated.

This updates application code, application database structure, and app URL settings. It does **not** change Windows execution policy, firewall rules, services, network configuration, certificate stores, system PATH, or PostgreSQL server settings. Node can use certificates already trusted by Windows for the current process when its `--use-system-ca` flag is supported; TLS verification stays enabled. Previous process environment values are restored when the script exits.

## If a check stops the update

- **Port in use:** stop the old OfficeHub terminal with Ctrl+C. If another application owns the port, choose an available approved port; the script does not kill it.
- **Local edits:** inspect `git status` and `git.exe diff HEAD -- next.config.ts`. The updater backs up the original local configuration before comparing it. An earlier Windows save may show a garbled dash in a comment alongside the intended `process.platform !== "win32"` adjustment; the current updater recognizes that combination. Other changes remain blocked and preserved. Commit or resolve those custom edits deliberately. Do not use `git reset --hard` to make the updater proceed.
- **Git asks to unlink a pack index:** answer `n` to each retry prompt and let the current command return. Do not delete `.git/objects` files or disable endpoint protection. Rerun the current update block, which skips automatic maintenance. The prompt alone does not mean the download or application data is corrupt.
- **`pg_dump.exe` missing:** point to your existing PostgreSQL installation without changing PATH:

  ```powershell
  $env:OFFICEHUB_PG_DUMP = "D:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
  ```

  Substitute the actual installation path. `Get-CimInstance Win32_Service -Filter "Name LIKE '%postgres%'" | Select-Object Name, PathName` can show the service executable; `pg_dump.exe` normally sits beside `pg_ctl.exe` in that installation's `bin` folder. Verify the chosen file with `Test-Path` and `pg_dump.exe --version`. The backup utility must be compatible with the database server version. A failed backup stops before schema changes.
- **Certificate chain failure:** use the company-approved CA bundle or ask IT to verify Node's access to the download host. Do not disable TLS verification or change certificate policy.
- **Database schema warning:** stop and review it. Do not add `--accept-data-loss` or `--force-reset`.
- **Build failure:** the process does not start a partial build. Backups are in the printed backup directory. The changes in this release are additive, so the existing tables and data remain. Resolve the reported error and rerun; do not reseed or restore the database over live work.

The PostgreSQL dump is a full database backup. If recovery is necessary, restore it into a **separate** database with pgAdmin/pg_restore, verify the contents, then deliberately select that database in `.env`. Do not restore over a running team's work. Backups contain business data and `.env` secrets; keep them private under your user account.

## Initial installation

For a new folder, clone `https://github.com/GopalGB/officehub.git` on `main`, create `.env` from `.env.example`, and configure the URL for an existing empty database and strong application secrets. The database password in `DATABASE_URL` must be URL-encoded, especially `@`, `:`, `%`, `#`, and `/`.

The update script builds and starts the app but does not create an administrator. On the first installation only, after dependencies and schema are initialized, run the seed with your configured `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`:

```powershell
node.exe --env-file=.env --import tsx prisma/seed.ts
if ($LASTEXITCODE -ne 0) { throw "Admin bootstrap failed." }
```

Existing installations already have an administrator. Changing `SEED_ADMIN_PASSWORD` in `.env` does not reset that user's stored password. Use Settings to change it.

## Network access

A colleague on the office network can open the server URL if existing network rules permit it. To diagnose reachability from that colleague's machine:

```powershell
Test-NetConnection 10.5.64.77 -Port 8599
```

A running app does not prove that every office subnet can reach it. If access is blocked, ask IT to review the existing network route and approved hosting configuration. Use your organization's approved HTTPS endpoint when available. This updater does not create firewall exceptions or certificates.

The process runs under your normal Windows user and stops when the terminal or user session closes. It does not install a service or scheduled task.

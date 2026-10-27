// Called with node --env-file=.env. Credentials stay out of command arguments.
import process from "node:process";
import { URL } from "node:url";
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
const [executable, output] = process.argv.slice(2);
if (!executable || !output || !process.env.DATABASE_URL)
  throw new Error(
    "Backup requires pg_dump, an output path, and DATABASE_URL from .env",
  );
const url = new URL(process.env.DATABASE_URL);
if (!["postgresql:", "postgres:"].includes(url.protocol))
  throw new Error("Expected a PostgreSQL URL");
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
};
const sslmode = url.searchParams.get("sslmode");
if (sslmode) env.PGSSLMODE = sslmode;
const result = spawnSync(
  executable,
  ["--format=custom", "--no-owner", "--no-acl", "--file", output],
  { env, stdio: ["ignore", "inherit", "inherit"] },
);
if (result.error || result.status !== 0)
  throw new Error(
    "Database backup failed. The database has not been upgraded.",
  );
if (statSync(output).size < 100)
  throw new Error("The database backup is empty. Upgrade stopped.");
process.stdout.write("Database backup created.\n");

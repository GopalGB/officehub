/* eslint-disable security/detect-non-literal-fs-filename -- Isolated temporary fixture paths, never office data. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { test } from "node:test";

// Native execution is covered here on Unix; the Windows updater suite separately
// covers client selection, paths with spaces, and stopping before schema changes.
void test("backup helper probes compatibility without exposing credentials or keeping a schema export", { skip: process.platform === "win32" }, () => {
  const root = mkdtempSync(join(tmpdir(), "officehub backup test "));
  try {
    const executable = join(root, "pg_dump.cjs");
    const trace = join(root, "trace.json");
    const output = join(root, "tracker.dump");
    writeFileSync(executable, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.writeFileSync(process.env.FIXTURE_TRACE, JSON.stringify({args, user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE}));
if (process.env.FIXTURE_FAIL === 'true') { process.stderr.write('incompatible server'); process.exit(1); }
if (!args.includes('--schema-only')) fs.writeFileSync(args[args.indexOf('--file') + 1], 'simulated database backup'.repeat(20));
process.stdout.write('schema output must be suppressed during probes');
`);
    chmodSync(executable, 0o700);
    const password = randomBytes(16).toString("hex") + "@:/";
    const databaseUrl = new URL("postgresql://127.0.0.1:5432/tracker");
    databaseUrl.username = "backup user";
    databaseUrl.password = password;
    const env = { ...process.env, DATABASE_URL: databaseUrl.href, FIXTURE_TRACE: trace };
    const run = (args: string[], fail = false) => spawnSync(process.execPath, ["scripts/backup-db.mjs", ...args], {
      cwd: process.cwd(), env: { ...env, FIXTURE_FAIL: String(fail) }, encoding: "utf8",
    });
    const compatible = run(["--check-client", executable]);
    assert.equal(compatible.status, 0, compatible.stderr);
    assert.equal(compatible.stdout, "");
    assert.equal(compatible.stderr, "");
    const call = JSON.parse(readFileSync(trace, "utf8")) as { args: string[]; user: string; password: string; database: string };
    assert.ok(call.args.includes("--schema-only"));
    assert.ok(call.args.includes("--no-password"));
    assert.equal(call.args[call.args.indexOf("--file") + 1], devNull);
    assert.equal(call.user, "backup user");
    assert.equal(call.password, password);
    assert.equal(call.database, "tracker");
    assert.ok(!call.args.join(" ").includes(password));
    const incompatible = run(["--check-client", executable], true);
    assert.equal(incompatible.status, 1);
    assert.equal(incompatible.stdout, "");
    assert.equal(incompatible.stderr, "");
    const missing = run(["--check-client", join(root, "missing client")]);
    assert.equal(missing.status, 1);
    const backup = run([executable, output]);
    assert.equal(backup.status, 0, backup.stderr);
    assert.ok(statSync(output).size > 100);
    const failedBackup = run([executable, output], true);
    assert.equal(failedBackup.status, 1);
    assert.match(failedBackup.stderr, /Database backup failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

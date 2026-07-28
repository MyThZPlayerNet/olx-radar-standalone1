import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the protected OLX Radar account experience", async () => {
  const [layout, login, panel, admin, packageJson, database, scheduler, docker] =
    await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/panel/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scheduler.ts", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /OLX Radar — prywatny monitor okazji/);
  assert.match(login, /Zaloguj się do radaru/);
  assert.match(login, /Nie ma publicznej rejestracji/);
  assert.match(panel, /Webhook nigdy nie jest wyświetlany po zapisaniu/);
  assert.match(admin, /Wygeneruj konto/);
  assert.equal(
    JSON.parse(packageJson).scripts.start,
    "node --env-file=.env .next/standalone/server.js",
  );
  assert.match(database, /node:sqlite/);
  assert.match(scheduler, /runDueMonitors/);
  assert.match(docker, /VOLUME \["\/app\/data"\]/);
  assert.doesNotMatch(packageJson, /vinext|wrangler|cloudflare/i);
  assert.doesNotMatch(`${layout}${login}${panel}${admin}`, /codex-preview/i);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the protected OLX and Vinted Radar Market experience", async () => {
  const [
    layout,
    login,
    panel,
    admin,
    packageJson,
    database,
    scheduler,
    store,
    vinted,
    docker,
  ] =
    await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/panel/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/database.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/scheduler.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/store.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/vinted.ts", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Radar Market — monitor OLX i Vinted/);
  assert.match(login, /Zaloguj się do radaru/);
  assert.match(login, /Nie ma publicznej rejestracji/);
  assert.match(panel, /Dwa serwisy\. Jedno konto\./);
  assert.match(panel, /Dodaj kolejne wyszukiwanie/);
  assert.match(panel, /Usuń zakładkę/);
  assert.match(panel, /Każda zakładka może wysyłać ogłoszenia na inny kanał/);
  assert.match(panel, /Radar Market · OLX \+ Vinted/);
  assert.match(admin, /Wygeneruj konto/);
  assert.match(admin, /Monitoring użytkowników/);
  assert.match(admin, /Teraz wyszukuje/);
  assert.match(admin, /Otwórz wyszukiwanie/);
  assert.equal(
    JSON.parse(packageJson).scripts.start,
    "node --env-file=.env .next/standalone/server.js",
  );
  assert.match(database, /node:sqlite/);
  assert.match(scheduler, /runDueMonitors/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS radar_profiles/);
  assert.match(store, /searches TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(store, /search_webhooks TEXT NOT NULL DEFAULT '\{\}'/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS radar_search_seen_offers/);
  assert.match(store, /maksymalnie 10 zakładek/);
  assert.match(store, /platform TEXT NOT NULL CHECK\(platform IN \('olx', 'vinted'\)\)/);
  assert.match(vinted, /api\/v2\/catalog\/items/);
  assert.match(vinted, /access_token_web/);
  assert.match(docker, /DATABASE_PATH=\/app\/data\/olx-radar\.db/);
  assert.doesNotMatch(docker, /^\s*VOLUME\b/m);
  assert.doesNotMatch(packageJson, /vinext|wrangler|cloudflare/i);
  assert.doesNotMatch(`${layout}${login}${panel}${admin}`, /codex-preview/i);
});

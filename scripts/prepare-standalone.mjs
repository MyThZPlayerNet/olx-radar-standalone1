import { cpSync, existsSync, mkdirSync } from "node:fs";

const standalone = new URL("../.next/standalone/", import.meta.url);
if (!existsSync(standalone)) {
  throw new Error("Brakuje katalogu .next/standalone. Najpierw wykonaj build.");
}

const publicSource = new URL("../public/", import.meta.url);
const publicTarget = new URL("../.next/standalone/public/", import.meta.url);
if (existsSync(publicSource)) {
  cpSync(publicSource, publicTarget, { force: true, recursive: true });
}

const staticSource = new URL("../.next/static/", import.meta.url);
const staticTarget = new URL("../.next/standalone/.next/static/", import.meta.url);
mkdirSync(new URL("../.next/standalone/.next/", import.meta.url), {
  recursive: true,
});
cpSync(staticSource, staticTarget, { force: true, recursive: true });

console.info(`Gotowa aplikacja standalone: ${standalone.pathname}`);

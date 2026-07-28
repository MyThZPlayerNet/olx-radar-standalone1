import { randomBytes, randomInt } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const target = new URL("../.env", import.meta.url);
if (existsSync(target)) {
  console.error("Plik .env już istnieje. Nie został nadpisany.");
  process.exit(1);
}

const groups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%*-_",
];
const alphabet = groups.join("");
const characters = groups.map((group) => group[randomInt(group.length)]);
while (characters.length < 24) {
  characters.push(alphabet[randomInt(alphabet.length)]);
}
for (let index = characters.length - 1; index > 0; index -= 1) {
  const swap = randomInt(index + 1);
  [characters[index], characters[swap]] = [characters[swap], characters[index]];
}
const password = characters.join("");
const encryptionKey = randomBytes(32).toString("base64");

writeFileSync(
  target,
  [
    "ADMIN_USERNAME=admin",
    `ADMIN_PASSWORD=${password}`,
    "ADMIN_DISPLAY_NAME=Administrator",
    `APP_ENCRYPTION_KEY=${encryptionKey}`,
    "APP_URL=http://localhost:3000",
    "DATABASE_PATH=./data/olx-radar.db",
    "MONITOR_TICK_SECONDS=10",
    "",
  ].join("\n"),
  { encoding: "utf8", flag: "wx" },
);

console.log("Gotowe. Utworzono bezpieczną konfigurację .env.");
console.log("");
console.log("Login administratora: admin");
console.log(`Hasło administratora: ${password}`);
console.log("");
console.log("Zapisz hasło w menedżerze haseł — skrypt nie pokaże go ponownie.");

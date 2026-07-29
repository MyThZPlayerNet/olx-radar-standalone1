import { encryptSecret } from "@/lib/crypto";
import type { DatabaseLike } from "@/lib/database";
import { HttpError } from "@/lib/errors";
import type { AppEnv } from "@/lib/runtime";
import type {
  ConfigInput,
  Platform,
  RadarConfig,
  RadarRow,
  RadarStatus,
  SellerType,
} from "@/lib/types";

let schemaReady: Promise<void> | null = null;

export function platformFromUnknown(value: unknown): Platform {
  if (value === "olx" || value === "vinted") return value;
  throw new HttpError(400, "Wybierz poprawny serwis: OLX albo Vinted.");
}

export async function ensureSchema(db: DatabaseLike): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.batch([
        db.prepare(`
          CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            must_change_password INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            failed_login_count INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            last_login_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        // Legacy tables are kept so existing Railway volumes can be migrated
        // without losing OLX settings, webhook secrets or seen-offer history.
        db.prepare(`
          CREATE TABLE IF NOT EXISTS radars (
            owner_username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
            name TEXT NOT NULL DEFAULT 'Mój radar',
            olx_url TEXT NOT NULL DEFAULT 'https://www.olx.pl/oferty/q-Iphone/',
            query TEXT NOT NULL DEFAULT 'Iphone',
            category_id INTEGER NOT NULL DEFAULT 0,
            min_price INTEGER DEFAULT 100,
            max_price INTEGER DEFAULT 7000,
            interval_seconds INTEGER NOT NULL DEFAULT 60,
            include_keywords TEXT NOT NULL DEFAULT '[]',
            exclude_keywords TEXT NOT NULL DEFAULT '["uszkodzony","uszkodzona","zamienię"]',
            match_all_keywords INTEGER NOT NULL DEFAULT 0,
            locations TEXT NOT NULL DEFAULT '[]',
            conditions TEXT NOT NULL DEFAULT '[]',
            seller_type TEXT NOT NULL DEFAULT 'all',
            delivery_required INTEGER NOT NULL DEFAULT 0,
            skip_promoted INTEGER NOT NULL DEFAULT 0,
            max_age_minutes INTEGER NOT NULL DEFAULT 180,
            discord_username TEXT NOT NULL DEFAULT 'OLX Radar',
            discord_avatar_url TEXT NOT NULL DEFAULT '',
            discord_role_id TEXT NOT NULL DEFAULT '',
            discord_color INTEGER NOT NULL DEFAULT 3447003,
            webhook_ciphertext TEXT,
            webhook_iv TEXT,
            active INTEGER NOT NULL DEFAULT 0,
            initialized INTEGER NOT NULL DEFAULT 0,
            last_check_at TEXT,
            next_check_at TEXT,
            last_error TEXT,
            last_fetched INTEGER NOT NULL DEFAULT 0,
            last_matched INTEGER NOT NULL DEFAULT 0,
            last_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS seen_offers (
            owner_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            offer_id TEXT NOT NULL,
            seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (owner_username, offer_id)
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS poll_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            fetched INTEGER NOT NULL DEFAULT 0,
            matched INTEGER NOT NULL DEFAULT 0,
            sent INTEGER NOT NULL DEFAULT 0,
            error TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS radar_profiles (
            owner_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            platform TEXT NOT NULL CHECK(platform IN ('olx', 'vinted')),
            name TEXT NOT NULL,
            source_url TEXT NOT NULL,
            query TEXT NOT NULL,
            category_id INTEGER NOT NULL DEFAULT 0,
            min_price INTEGER DEFAULT 100,
            max_price INTEGER DEFAULT 7000,
            interval_seconds INTEGER NOT NULL DEFAULT 60,
            include_keywords TEXT NOT NULL DEFAULT '[]',
            exclude_keywords TEXT NOT NULL DEFAULT '[]',
            match_all_keywords INTEGER NOT NULL DEFAULT 0,
            locations TEXT NOT NULL DEFAULT '[]',
            conditions TEXT NOT NULL DEFAULT '[]',
            seller_type TEXT NOT NULL DEFAULT 'all',
            delivery_required INTEGER NOT NULL DEFAULT 0,
            skip_promoted INTEGER NOT NULL DEFAULT 0,
            max_age_minutes INTEGER NOT NULL DEFAULT 180,
            discord_username TEXT NOT NULL,
            discord_avatar_url TEXT NOT NULL DEFAULT '',
            discord_role_id TEXT NOT NULL DEFAULT '',
            discord_color INTEGER NOT NULL DEFAULT 3447003,
            webhook_ciphertext TEXT,
            webhook_iv TEXT,
            active INTEGER NOT NULL DEFAULT 0,
            initialized INTEGER NOT NULL DEFAULT 0,
            last_check_at TEXT,
            next_check_at TEXT,
            last_error TEXT,
            last_fetched INTEGER NOT NULL DEFAULT 0,
            last_matched INTEGER NOT NULL DEFAULT 0,
            last_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (owner_username, platform)
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS radar_seen_offers (
            owner_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            platform TEXT NOT NULL CHECK(platform IN ('olx', 'vinted')),
            offer_id TEXT NOT NULL,
            seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (owner_username, platform, offer_id)
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS radar_poll_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            platform TEXT NOT NULL CHECK(platform IN ('olx', 'vinted')),
            fetched INTEGER NOT NULL DEFAULT 0,
            matched INTEGER NOT NULL DEFAULT 0,
            sent INTEGER NOT NULL DEFAULT 0,
            error TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS radar_profiles_due_idx ON radar_profiles(active, next_check_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)",
        ),
        db.prepare(
          "CREATE INDEX IF NOT EXISTS radar_seen_owner_idx ON radar_seen_offers(owner_username, platform, seen_at)",
        ),
      ]);

      await db.batch([
        db.prepare(`
          INSERT OR IGNORE INTO radar_profiles (
            owner_username, platform, name, source_url, query, category_id,
            min_price, max_price, interval_seconds, include_keywords,
            exclude_keywords, match_all_keywords, locations, conditions,
            seller_type, delivery_required, skip_promoted, max_age_minutes,
            discord_username, discord_avatar_url, discord_role_id, discord_color,
            webhook_ciphertext, webhook_iv, active, initialized, last_check_at,
            next_check_at, last_error, last_fetched, last_matched, last_sent,
            created_at, updated_at
          )
          SELECT
            owner_username, 'olx', name, olx_url, query, category_id,
            min_price, max_price, interval_seconds, include_keywords,
            exclude_keywords, match_all_keywords, locations, conditions,
            seller_type, delivery_required, skip_promoted, max_age_minutes,
            discord_username, discord_avatar_url, discord_role_id, discord_color,
            webhook_ciphertext, webhook_iv, active, initialized, last_check_at,
            next_check_at, last_error, last_fetched, last_matched, last_sent,
            created_at, updated_at
          FROM radars
        `),
        db.prepare(`
          INSERT OR IGNORE INTO radar_seen_offers (
            owner_username, platform, offer_id, seen_at
          )
          SELECT owner_username, 'olx', offer_id, seen_at FROM seen_offers
        `),
      ]);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function ensureRadar(
  db: DatabaseLike,
  username: string,
): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO radar_profiles (
           owner_username, platform, name, source_url, query,
           exclude_keywords, discord_username, discord_color
         ) VALUES (?, 'olx', 'Mój radar OLX',
           'https://www.olx.pl/oferty/q-Iphone/', 'Iphone',
           '["uszkodzony","uszkodzona","zamienię"]', 'OLX Radar', 3447003)`,
      )
      .bind(username),
    db
      .prepare(
        `INSERT OR IGNORE INTO radar_profiles (
           owner_username, platform, name, source_url, query,
           exclude_keywords, discord_username, discord_color, max_age_minutes
         ) VALUES (?, 'vinted', 'Mój radar Vinted',
           'https://www.vinted.pl/catalog?search_text=iphone', 'iphone',
           '["uszkodzony","podróbka"]', 'Vinted Radar', 4830909, 0)`,
      )
      .bind(username),
  ]);
}

export async function getRadarRow(
  db: DatabaseLike,
  username: string,
  platform: Platform,
): Promise<RadarRow> {
  await ensureRadar(db, username);
  const row = await db
    .prepare(
      "SELECT * FROM radar_profiles WHERE owner_username = ? AND platform = ?",
    )
    .bind(username, platform)
    .first<RadarRow>();
  if (!row) throw new HttpError(404, "Nie znaleziono konfiguracji radaru.");
  return row;
}

export async function getRadarRows(
  db: DatabaseLike,
  username: string,
): Promise<Record<Platform, RadarRow>> {
  await ensureRadar(db, username);
  const result = await db
    .prepare("SELECT * FROM radar_profiles WHERE owner_username = ?")
    .bind(username)
    .all<RadarRow>();
  const rows = result.results ?? [];
  const olx = rows.find((row) => row.platform === "olx");
  const vinted = rows.find((row) => row.platform === "vinted");
  if (!olx || !vinted) {
    throw new HttpError(404, "Nie udało się przygotować obu radarów.");
  }
  return { olx, vinted };
}

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function publicConfig(row: RadarRow): RadarConfig {
  return {
    active: Boolean(row.active),
    categoryId: row.category_id,
    conditions: parseList(row.conditions),
    deliveryRequired: Boolean(row.delivery_required),
    discordAvatarUrl: row.discord_avatar_url,
    discordColor: row.discord_color,
    discordRoleId: row.discord_role_id,
    discordUsername: row.discord_username,
    excludeKeywords: parseList(row.exclude_keywords),
    includeKeywords: parseList(row.include_keywords),
    intervalSeconds: row.interval_seconds,
    locations: parseList(row.locations),
    matchAllKeywords: Boolean(row.match_all_keywords),
    maxAgeMinutes: row.max_age_minutes,
    maxPrice: row.max_price,
    minPrice: row.min_price,
    name: row.name,
    platform: row.platform,
    query: row.query,
    sellerType: row.seller_type,
    skipPromoted: Boolean(row.skip_promoted),
    sourceUrl: row.source_url,
    webhookConfigured: Boolean(row.webhook_ciphertext && row.webhook_iv),
  };
}

export function publicStatus(row: RadarRow): RadarStatus {
  return {
    active: Boolean(row.active),
    initialized: Boolean(row.initialized),
    lastCheckAt: row.last_check_at,
    lastError: row.last_error,
    lastFetched: row.last_fetched,
    lastMatched: row.last_matched,
    lastSent: row.last_sent,
    nextCheckAt: row.next_check_at,
    webhookConfigured: Boolean(row.webhook_ciphertext && row.webhook_iv),
  };
}

function requiredText(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label}: uzupełnij pole.`);
  }
  return value.trim().slice(0, max);
}

function optionalText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label}: podaj liczbę od ${min} do ${max}.`);
  }
  return number;
}

function optionalPrice(value: unknown, label: string): number | null {
  if (value === null || value === "") return null;
  return integer(value, label, 0, 100_000_000);
}

function list(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new HttpError(400, `${label}: niepoprawna lista.`);
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].slice(
    0,
    30,
  );
}

function sellerType(value: unknown): SellerType {
  if (value === "all" || value === "private" || value === "business") return value;
  throw new HttpError(400, "Wybierz poprawny typ sprzedającego.");
}

function validateSourceUrl(value: string, platform: Platform): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Wklej poprawny adres wyszukiwania.");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "Adres wyszukiwania musi używać HTTPS.");
  }
  if (platform === "olx") {
    if (!(url.hostname === "olx.pl" || url.hostname.endsWith(".olx.pl"))) {
      throw new HttpError(400, "Adres musi prowadzić do serwisu olx.pl.");
    }
    return;
  }
  if (
    !(url.hostname === "vinted.pl" || url.hostname === "www.vinted.pl") ||
    !url.pathname.startsWith("/catalog")
  ) {
    throw new HttpError(
      400,
      "Wklej link do wyników wyszukiwania z vinted.pl/catalog.",
    );
  }
}

export function validateWebhookUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "Webhook Discord ma niepoprawny format.");
  }
  const allowed = new Set([
    "discord.com",
    "discordapp.com",
    "canary.discord.com",
    "ptb.discord.com",
  ]);
  if (
    url.protocol !== "https:" ||
    !allowed.has(url.hostname) ||
    !url.pathname.startsWith("/api/webhooks/")
  ) {
    throw new HttpError(400, "Wklej prawidłowy webhook Discord.");
  }
}

export async function saveRadar(
  env: AppEnv,
  username: string,
  platform: Platform,
  requestUrl: string,
  raw: ConfigInput,
): Promise<RadarConfig> {
  await ensureRadar(env.DB, username);
  const name = requiredText(raw.name, "Nazwa radaru", 80);
  const sourceUrl = requiredText(raw.sourceUrl, "Link wyszukiwania", 1500);
  validateSourceUrl(sourceUrl, platform);
  const query = requiredText(raw.query, "Fraza wyszukiwania", 160);
  const minPrice = optionalPrice(raw.minPrice, "Cena od");
  const maxPrice = optionalPrice(raw.maxPrice, "Cena do");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new HttpError(400, "Cena minimalna nie może być wyższa od maksymalnej.");
  }

  let webhookCiphertext: string | null | undefined;
  let webhookIv: string | null | undefined;
  if (raw.removeWebhook) {
    webhookCiphertext = null;
    webhookIv = null;
  } else if (typeof raw.webhookUrl === "string" && raw.webhookUrl.trim()) {
    const webhook = raw.webhookUrl.trim();
    validateWebhookUrl(webhook);
    const encrypted = await encryptSecret(env, requestUrl, webhook);
    webhookCiphertext = encrypted.ciphertext;
    webhookIv = encrypted.iv;
  }

  const assignments = [
    "name = ?",
    "source_url = ?",
    "query = ?",
    "category_id = ?",
    "min_price = ?",
    "max_price = ?",
    "interval_seconds = ?",
    "include_keywords = ?",
    "exclude_keywords = ?",
    "match_all_keywords = ?",
    "locations = ?",
    "conditions = ?",
    "seller_type = ?",
    "delivery_required = ?",
    "skip_promoted = ?",
    "max_age_minutes = ?",
    "discord_username = ?",
    "discord_avatar_url = ?",
    "discord_role_id = ?",
    "discord_color = ?",
    "updated_at = CURRENT_TIMESTAMP",
  ];
  const values: unknown[] = [
    name,
    sourceUrl,
    query,
    integer(raw.categoryId, "ID kategorii", 0, 999_999),
    minPrice,
    maxPrice,
    integer(raw.intervalSeconds, "Częstotliwość", 30, 86_400),
    JSON.stringify(list(raw.includeKeywords, "Słowa wymagane")),
    JSON.stringify(list(raw.excludeKeywords, "Słowa wykluczone")),
    raw.matchAllKeywords === true ? 1 : 0,
    JSON.stringify(list(raw.locations, "Lokalizacje")),
    JSON.stringify(list(raw.conditions, "Stan przedmiotu")),
    sellerType(raw.sellerType),
    raw.deliveryRequired === true ? 1 : 0,
    raw.skipPromoted === true ? 1 : 0,
    integer(raw.maxAgeMinutes, "Wiek ogłoszenia", 0, 525_600),
    requiredText(raw.discordUsername, "Nazwa nadawcy", 80),
    optionalText(raw.discordAvatarUrl, 1000),
    optionalText(raw.discordRoleId, 40),
    integer(raw.discordColor, "Kolor Discord", 0, 0xffffff),
  ];
  if (webhookCiphertext !== undefined) {
    assignments.push("webhook_ciphertext = ?", "webhook_iv = ?");
    values.push(webhookCiphertext, webhookIv);
  }
  values.push(username, platform);

  await env.DB.prepare(
    `UPDATE radar_profiles SET ${assignments.join(", ")}
     WHERE owner_username = ? AND platform = ?`,
  )
    .bind(...values)
    .run();
  return publicConfig(await getRadarRow(env.DB, username, platform));
}

export async function setRadarActive(
  db: DatabaseLike,
  username: string,
  platform: Platform,
  active: boolean,
): Promise<RadarStatus> {
  const row = await getRadarRow(db, username, platform);
  if (active && !(row.webhook_ciphertext && row.webhook_iv)) {
    throw new HttpError(
      400,
      `Najpierw dodaj webhook Discord dla radaru ${platform === "olx" ? "OLX" : "Vinted"}.`,
    );
  }
  await db
    .prepare(
      `UPDATE radar_profiles
       SET active = ?,
           next_check_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE owner_username = ? AND platform = ?`,
    )
    .bind(active ? 1 : 0, active ? 1 : 0, username, platform)
    .run();
  return publicStatus(await getRadarRow(db, username, platform));
}

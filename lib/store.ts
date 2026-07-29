import { encryptSecret } from "@/lib/crypto";
import type { DatabaseLike } from "@/lib/database";
import { HttpError } from "@/lib/errors";
import type { AppEnv } from "@/lib/runtime";
import type {
  ConfigInput,
  Platform,
  RadarConfig,
  RadarRow,
  RadarSearch,
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
            searches TEXT NOT NULL DEFAULT '[]',
            search_webhooks TEXT NOT NULL DEFAULT '{}',
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
          CREATE TABLE IF NOT EXISTS radar_search_seen_offers (
            owner_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            platform TEXT NOT NULL CHECK(platform IN ('olx', 'vinted')),
            search_id TEXT NOT NULL,
            offer_id TEXT NOT NULL,
            seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (owner_username, platform, search_id, offer_id)
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
        db.prepare(
          "CREATE INDEX IF NOT EXISTS radar_search_seen_owner_idx ON radar_search_seen_offers(owner_username, platform, search_id, seen_at)",
        ),
      ]);

      const profileColumns = await db
        .prepare("PRAGMA table_info(radar_profiles)")
        .all<{ name: string }>();
      if (
        !(profileColumns.results ?? []).some(
          (column) => column.name === "searches",
        )
      ) {
        await db
          .prepare(
            "ALTER TABLE radar_profiles ADD COLUMN searches TEXT NOT NULL DEFAULT '[]'",
          )
          .run();
      }
      if (
        !(profileColumns.results ?? []).some(
          (column) => column.name === "search_webhooks",
        )
      ) {
        await db
          .prepare(
            "ALTER TABLE radar_profiles ADD COLUMN search_webhooks TEXT NOT NULL DEFAULT '{}'",
          )
          .run();
      }

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
        db.prepare(`
          INSERT OR IGNORE INTO radar_search_seen_offers (
            owner_username, platform, search_id, offer_id, seen_at
          )
          SELECT owner_username, platform, 'default', offer_id, seen_at
          FROM radar_seen_offers
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

function legacySearch(row: RadarRow): RadarSearch {
  return {
    categoryId: row.category_id,
    conditions: parseList(row.conditions),
    deliveryRequired: Boolean(row.delivery_required),
    excludeKeywords: parseList(row.exclude_keywords),
    id: "default",
    includeKeywords: parseList(row.include_keywords),
    locations: parseList(row.locations),
    matchAllKeywords: Boolean(row.match_all_keywords),
    maxAgeMinutes: row.max_age_minutes,
    maxPrice: row.max_price,
    minPrice: row.min_price,
    name: row.name,
    query: row.query,
    sellerType: row.seller_type,
    skipPromoted: Boolean(row.skip_promoted),
    sourceUrl: row.source_url,
    webhookConfigured: false,
  };
}

function parseSearches(row: RadarRow): RadarSearch[] {
  const fallback = legacySearch(row);
  try {
    const parsed = JSON.parse(row.searches);
    if (!Array.isArray(parsed) || !parsed.length) return [fallback];
    return parsed
      .filter(
        (item): item is Partial<RadarSearch> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
      .slice(0, 10)
      .map((item, index) => ({
        ...fallback,
        ...item,
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim().slice(0, 80)
            : `search-${index + 1}`,
        name:
          typeof item.name === "string" && item.name.trim()
            ? item.name.trim().slice(0, 80)
            : `Wyszukiwanie ${index + 1}`,
      }));
  } catch {
    return [fallback];
  }
}

export type EncryptedWebhook = {
  ciphertext: string;
  iv: string;
};

function parseSearchWebhooks(row: RadarRow): Record<string, EncryptedWebhook> {
  try {
    const parsed = JSON.parse(row.search_webhooks);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, EncryptedWebhook> = {};
    for (const [searchId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const candidate = value as Partial<EncryptedWebhook>;
      if (
        typeof candidate.ciphertext === "string" &&
        candidate.ciphertext &&
        typeof candidate.iv === "string" &&
        candidate.iv
      ) {
        result[searchId] = {
          ciphertext: candidate.ciphertext,
          iv: candidate.iv,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function encryptedWebhookForSearch(
  row: RadarRow,
  searchId: string,
): EncryptedWebhook | null {
  const configured = parseSearchWebhooks(row)[searchId];
  if (configured) return configured;
  if (
    searchId === "default" &&
    row.webhook_ciphertext &&
    row.webhook_iv
  ) {
    return {
      ciphertext: row.webhook_ciphertext,
      iv: row.webhook_iv,
    };
  }
  return null;
}

export function publicConfig(row: RadarRow): RadarConfig {
  const searches = parseSearches(row).map((search) => ({
    ...search,
    webhookConfigured: Boolean(encryptedWebhookForSearch(row, search.id)),
  }));
  const primary = searches[0];
  return {
    ...primary,
    active: Boolean(row.active),
    discordAvatarUrl: row.discord_avatar_url,
    discordColor: row.discord_color,
    discordRoleId: row.discord_role_id,
    discordUsername: row.discord_username,
    intervalSeconds: row.interval_seconds,
    platform: row.platform,
    searches,
    webhookConfigured: searches.every((search) => search.webhookConfigured),
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
    webhookConfigured: publicConfig(row).webhookConfigured,
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

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Niepoprawna konfiguracja wyszukiwania.");
  }
  return value as Record<string, unknown>;
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

function validateSearch(
  value: unknown,
  platform: Platform,
  index: number,
): RadarSearch {
  const raw = object(value);
  const label = `Zakładka ${index + 1}`;
  const id = requiredText(raw.id, `${label} — identyfikator`, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new HttpError(
      400,
      `${label}: zapisz zakładkę ponownie, aby odświeżyć jej identyfikator.`,
    );
  }
  const name = requiredText(raw.name, `${label} — nazwa`, 80);
  const sourceUrl = requiredText(
    raw.sourceUrl,
    `${label} — link wyszukiwania`,
    1500,
  );
  validateSourceUrl(sourceUrl, platform);
  const query = requiredText(raw.query, `${label} — fraza`, 160);
  const minPrice = optionalPrice(raw.minPrice, `${label} — cena od`);
  const maxPrice = optionalPrice(raw.maxPrice, `${label} — cena do`);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new HttpError(
      400,
      `${label}: cena minimalna nie może być wyższa od maksymalnej.`,
    );
  }
  return {
    categoryId: integer(
      raw.categoryId,
      `${label} — ID kategorii`,
      0,
      999_999,
    ),
    conditions: list(raw.conditions, `${label} — stan przedmiotu`),
    deliveryRequired: raw.deliveryRequired === true,
    excludeKeywords: list(
      raw.excludeKeywords,
      `${label} — słowa wykluczone`,
    ),
    id,
    includeKeywords: list(raw.includeKeywords, `${label} — słowa wymagane`),
    locations: list(raw.locations, `${label} — lokalizacje`),
    matchAllKeywords: raw.matchAllKeywords === true,
    maxAgeMinutes: integer(
      raw.maxAgeMinutes,
      `${label} — wiek ogłoszenia`,
      0,
      525_600,
    ),
    maxPrice,
    minPrice,
    name,
    query,
    sellerType: sellerType(raw.sellerType),
    skipPromoted: raw.skipPromoted === true,
    sourceUrl,
    webhookConfigured: false,
  };
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
  const rawSearches =
    Array.isArray(raw.searches) && raw.searches.length ? raw.searches : [raw];
  if (rawSearches.length > 10) {
    throw new HttpError(400, "Możesz utworzyć maksymalnie 10 zakładek.");
  }
  const searches = rawSearches.map((search, index) =>
    validateSearch(search, platform, index),
  );
  if (new Set(searches.map((search) => search.id)).size !== searches.length) {
    throw new HttpError(400, "Każda zakładka musi mieć unikalny identyfikator.");
  }
  const primary = searches[0];

  const currentRow = await getRadarRow(env.DB, username, platform);
  const searchWebhooks = parseSearchWebhooks(currentRow);
  const searchIds = new Set(searches.map((search) => search.id));
  for (const searchId of Object.keys(searchWebhooks)) {
    if (!searchIds.has(searchId)) delete searchWebhooks[searchId];
  }
  const webhookSearchId =
    typeof raw.webhookSearchId === "string" && raw.webhookSearchId.trim()
      ? raw.webhookSearchId.trim()
      : primary.id;
  if (!searchIds.has(webhookSearchId)) {
    throw new HttpError(400, "Nie znaleziono zakładki dla tego webhooka.");
  }
  if (raw.removeWebhook) {
    delete searchWebhooks[webhookSearchId];
  } else if (typeof raw.webhookUrl === "string" && raw.webhookUrl.trim()) {
    const webhook = raw.webhookUrl.trim();
    validateWebhookUrl(webhook);
    const encrypted = await encryptSecret(env, requestUrl, webhook);
    searchWebhooks[webhookSearchId] = encrypted;
  }

  const assignments = [
    "name = ?",
    "source_url = ?",
    "query = ?",
    "searches = ?",
    "search_webhooks = ?",
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
    "initialized = 0",
    "next_check_at = CASE WHEN active = 1 THEN CURRENT_TIMESTAMP ELSE next_check_at END",
    "updated_at = CURRENT_TIMESTAMP",
  ];
  const values: unknown[] = [
    primary.name,
    primary.sourceUrl,
    primary.query,
    JSON.stringify(searches),
    JSON.stringify(searchWebhooks),
    primary.categoryId,
    primary.minPrice,
    primary.maxPrice,
    integer(raw.intervalSeconds, "Częstotliwość", 30, 86_400),
    JSON.stringify(primary.includeKeywords),
    JSON.stringify(primary.excludeKeywords),
    primary.matchAllKeywords ? 1 : 0,
    JSON.stringify(primary.locations),
    JSON.stringify(primary.conditions),
    primary.sellerType,
    primary.deliveryRequired ? 1 : 0,
    primary.skipPromoted ? 1 : 0,
    primary.maxAgeMinutes,
    requiredText(raw.discordUsername, "Nazwa nadawcy", 80),
    optionalText(raw.discordAvatarUrl, 1000),
    optionalText(raw.discordRoleId, 40),
    integer(raw.discordColor, "Kolor Discord", 0, 0xffffff),
  ];
  if (raw.removeWebhook && webhookSearchId === "default") {
    assignments.push("webhook_ciphertext = NULL", "webhook_iv = NULL");
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
  const config = publicConfig(row);
  if (active && !config.webhookConfigured) {
    const missing = config.searches
      .filter((search) => !search.webhookConfigured)
      .map((search) => search.name)
      .join(", ");
    throw new HttpError(
      400,
      `Najpierw dodaj webhook Discord dla każdej zakładki. Brakuje: ${missing}.`,
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

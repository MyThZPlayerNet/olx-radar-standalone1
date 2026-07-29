import { decryptSecret } from "@/lib/crypto";
import type { DatabaseLike } from "@/lib/database";
import { sendDiscordOffer } from "@/lib/discord";
import { matchesRadar, toPublicOffer, type Offer } from "@/lib/offers";
import { fetchOlxOffers } from "@/lib/olx";
import {
  encryptedWebhookForSearch,
  ensureSchema,
  getRadarRow,
  publicConfig,
  publicStatus,
} from "@/lib/store";
import type { AppEnv } from "@/lib/runtime";
import type {
  Platform,
  PublicOffer,
  RadarConfig,
  RadarRow,
  RadarSearch,
  RadarStatus,
} from "@/lib/types";
import { fetchVintedOffers } from "@/lib/vinted";

export type CheckResult = RadarStatus & {
  offers: PublicOffer[];
  skipped?: boolean;
};

type MatchedOffer = {
  config: RadarConfig;
  offer: Offer;
};

async function recordRun(
  db: DatabaseLike,
  username: string,
  platform: Platform,
  fetched: number,
  matched: number,
  sent: number,
  error: string | null,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE radar_profiles SET
           last_check_at = CURRENT_TIMESTAMP,
           last_fetched = ?,
           last_matched = ?,
           last_sent = ?,
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE owner_username = ? AND platform = ?`,
      )
      .bind(fetched, matched, sent, error, username, platform),
    db
      .prepare(
        `INSERT INTO radar_poll_runs (
           owner_username, platform, fetched, matched, sent, error
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(username, platform, fetched, matched, sent, error),
    db
      .prepare(
        `DELETE FROM radar_poll_runs
         WHERE owner_username = ? AND platform = ? AND id NOT IN (
           SELECT id FROM radar_poll_runs
           WHERE owner_username = ? AND platform = ?
           ORDER BY id DESC LIMIT 30
         )`,
      )
      .bind(username, platform, username, platform),
    db
      .prepare(
        `DELETE FROM radar_search_seen_offers
         WHERE owner_username = ? AND platform = ?
           AND seen_at < datetime('now', '-90 days')`,
      )
      .bind(username, platform),
  ]);
}

async function claimDueRadar(
  db: DatabaseLike,
  username: string,
  platform: Platform,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE radar_profiles
       SET next_check_at = datetime('now', '+' || interval_seconds || ' seconds')
       WHERE owner_username = ?
         AND platform = ?
         AND active = 1
         AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)`,
    )
    .bind(username, platform)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

async function unseenMatches(
  db: DatabaseLike,
  username: string,
  platform: Platform,
  matches: MatchedOffer[],
): Promise<MatchedOffer[]> {
  if (!matches.length) return [];
  const grouped = new Map<string, string[]>();
  for (const match of matches) {
    const ids = grouped.get(match.config.id) ?? [];
    ids.push(match.offer.id);
    grouped.set(match.config.id, ids);
  }
  const seen = new Set<string>();
  for (const [searchId, offerIds] of grouped) {
    const placeholders = offerIds.map(() => "?").join(",");
    const result = await db
      .prepare(
        `SELECT offer_id FROM radar_search_seen_offers
         WHERE owner_username = ? AND platform = ? AND search_id = ?
           AND offer_id IN (${placeholders})`,
      )
      .bind(username, platform, searchId, ...offerIds)
      .all<{ offer_id: string }>();
    for (const row of result.results ?? []) {
      seen.add(`${searchId}:${row.offer_id}`);
    }
  }
  return matches.filter(
    (match) => !seen.has(`${match.config.id}:${match.offer.id}`),
  );
}

async function rememberMatches(
  db: DatabaseLike,
  username: string,
  platform: Platform,
  matches: MatchedOffer[],
): Promise<void> {
  if (!matches.length) return;
  await db.batch(
    matches.map((match) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO radar_search_seen_offers (
             owner_username, platform, search_id, offer_id
           ) VALUES (?, ?, ?, ?)`,
        )
        .bind(username, platform, match.config.id, match.offer.id),
    ),
  );
}

async function fetchOffers(config: RadarConfig): Promise<Offer[]> {
  return config.platform === "olx"
    ? fetchOlxOffers(config)
    : fetchVintedOffers(config);
}

function configForSearch(
  config: RadarConfig,
  search: RadarSearch,
): RadarConfig {
  return {
    ...config,
    ...search,
    searches: [search],
  };
}

async function collectMatchingOffers(
  row: RadarRow,
  selectedSearchId?: string,
): Promise<{
  errors: string[];
  fetched: number;
  matches: MatchedOffer[];
}> {
  const config = publicConfig(row);
  const searches = selectedSearchId
    ? config.searches.filter((search) => search.id === selectedSearchId)
    : config.searches;
  if (!searches.length) {
    throw new Error("Nie znaleziono wybranej zakładki wyszukiwania.");
  }

  const errors: string[] = [];
  const matches: MatchedOffer[] = [];
  const matchedKeys = new Set<string>();
  let fetched = 0;
  let successfulSearches = 0;

  for (const search of searches) {
    const searchConfig = configForSearch(config, search);
    try {
      const offers = await fetchOffers(searchConfig);
      successfulSearches += 1;
      fetched += offers.length;
      for (const offer of offers) {
        const key = `${search.id}:${offer.id}`;
        if (matchesRadar(offer, searchConfig) && !matchedKeys.has(key)) {
          matchedKeys.add(key);
          matches.push({ config: searchConfig, offer });
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nie udało się pobrać ogłoszeń.";
      errors.push(`${search.name}: ${message}`);
    }
  }

  if (!successfulSearches) {
    throw new Error(errors.join(" · ") || "Nie udało się sprawdzić zakładek.");
  }
  return { errors, fetched, matches };
}

async function processRadar(
  env: AppEnv,
  row: RadarRow,
  requestUrl: string,
): Promise<CheckResult> {
  try {
    const result = await collectMatchingOffers(row);
    const matching = result.matches.map((item) => item.offer);
    const runErrors = [...result.errors];
    let sent = 0;

    if (!row.initialized) {
      await rememberMatches(
        env.DB,
        row.owner_username,
        row.platform,
        result.matches,
      );
      await env.DB
        .prepare(
          `UPDATE radar_profiles SET initialized = 1
           WHERE owner_username = ? AND platform = ?`,
        )
        .bind(row.owner_username, row.platform)
        .run();
    } else {
      const fresh = await unseenMatches(
        env.DB,
        row.owner_username,
        row.platform,
        result.matches,
      );
      const webhookCache = new Map<string, string>();
      for (const match of fresh.slice(0, 10)) {
        const searchId = match.config.id;
        const encrypted = encryptedWebhookForSearch(row, searchId);
        if (!encrypted) {
          runErrors.push(
            `${match.config.name}: webhook Discord nie jest skonfigurowany.`,
          );
          continue;
        }
        let webhook = webhookCache.get(searchId);
        if (!webhook) {
          webhook = await decryptSecret(
            env,
            requestUrl,
            encrypted.ciphertext,
            encrypted.iv,
          );
          webhookCache.set(searchId, webhook);
        }
        await sendDiscordOffer(webhook, match.config, match.offer);
        await rememberMatches(env.DB, row.owner_username, row.platform, [match]);
        sent += 1;
      }
    }

    await recordRun(
      env.DB,
      row.owner_username,
      row.platform,
      result.fetched,
      matching.length,
      sent,
      runErrors.length ? [...new Set(runErrors)].join(" · ").slice(0, 1500) : null,
    );
    return {
      ...publicStatus(
        await getRadarRow(env.DB, row.owner_username, row.platform),
      ),
      offers: matching.slice(0, 24).map(toPublicOffer),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się sprawdzić ogłoszeń.";
    await recordRun(
      env.DB,
      row.owner_username,
      row.platform,
      0,
      0,
      0,
      message,
    );
    throw error;
  }
}

export async function runUserRadar(
  env: AppEnv,
  username: string,
  platform: Platform,
  requestUrl: string,
): Promise<CheckResult> {
  await ensureSchema(env.DB);
  const claimed = await claimDueRadar(env.DB, username, platform);
  if (!claimed) {
    const row = await getRadarRow(env.DB, username, platform);
    return { ...publicStatus(row), offers: [], skipped: true };
  }
  return processRadar(
    env,
    await getRadarRow(env.DB, username, platform),
    requestUrl,
  );
}

export async function previewUserRadar(
  env: AppEnv,
  username: string,
  platform: Platform,
  searchId?: string,
): Promise<{
  fetched: number;
  matched: number;
  offers: PublicOffer[];
}> {
  const row = await getRadarRow(env.DB, username, platform);
  const result = await collectMatchingOffers(row, searchId);
  return {
    fetched: result.fetched,
    matched: result.matches.length,
    offers: result.matches
      .slice(0, 24)
      .map((item) => toPublicOffer(item.offer)),
  };
}

export async function runDueMonitors(
  env: AppEnv,
  requestUrl: string,
): Promise<void> {
  await ensureSchema(env.DB);
  const result = await env.DB
    .prepare(
      `SELECT * FROM radar_profiles
       WHERE active = 1
         AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)
       ORDER BY next_check_at ASC
       LIMIT 20`,
    )
    .all<RadarRow>();

  for (const row of result.results ?? []) {
    const claimed = await claimDueRadar(
      env.DB,
      row.owner_username,
      row.platform,
    );
    if (!claimed) continue;
    try {
      await processRadar(
        env,
        await getRadarRow(env.DB, row.owner_username, row.platform),
        requestUrl,
      );
    } catch {
      // One account or marketplace failure must not block the other radars.
    }
  }
}

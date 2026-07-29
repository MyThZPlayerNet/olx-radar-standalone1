import { decryptSecret } from "@/lib/crypto";
import type { DatabaseLike } from "@/lib/database";
import { sendDiscordOffer } from "@/lib/discord";
import { matchesRadar, toPublicOffer, type Offer } from "@/lib/offers";
import { fetchOlxOffers } from "@/lib/olx";
import {
  ensureSchema,
  getRadarRow,
  publicConfig,
  publicStatus,
} from "@/lib/store";
import type { AppEnv } from "@/lib/runtime";
import type {
  Platform,
  PublicOffer,
  RadarRow,
  RadarStatus,
} from "@/lib/types";
import { fetchVintedOffers } from "@/lib/vinted";

export type CheckResult = RadarStatus & {
  offers: PublicOffer[];
  skipped?: boolean;
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
        `DELETE FROM radar_seen_offers
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

async function unseenOffers(
  db: DatabaseLike,
  username: string,
  platform: Platform,
  offers: Offer[],
): Promise<Offer[]> {
  if (!offers.length) return [];
  const placeholders = offers.map(() => "?").join(",");
  const result = await db
    .prepare(
      `SELECT offer_id FROM radar_seen_offers
       WHERE owner_username = ? AND platform = ?
         AND offer_id IN (${placeholders})`,
    )
    .bind(username, platform, ...offers.map((offer) => offer.id))
    .all<{ offer_id: string }>();
  const seen = new Set((result.results ?? []).map((row) => row.offer_id));
  return offers.filter((offer) => !seen.has(offer.id));
}

async function rememberOffers(
  db: DatabaseLike,
  username: string,
  platform: Platform,
  offers: Offer[],
): Promise<void> {
  if (!offers.length) return;
  await db.batch(
    offers.map((offer) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO radar_seen_offers (
             owner_username, platform, offer_id
           ) VALUES (?, ?, ?)`,
        )
        .bind(username, platform, offer.id),
    ),
  );
}

async function fetchOffers(row: RadarRow): Promise<Offer[]> {
  const config = publicConfig(row);
  return row.platform === "olx"
    ? fetchOlxOffers(config)
    : fetchVintedOffers(config);
}

async function processRadar(
  env: AppEnv,
  row: RadarRow,
  requestUrl: string,
): Promise<CheckResult> {
  const config = publicConfig(row);
  try {
    const offers = await fetchOffers(row);
    const matching = offers.filter((offer) => matchesRadar(offer, config));
    let sent = 0;

    if (!row.initialized) {
      await rememberOffers(
        env.DB,
        row.owner_username,
        row.platform,
        matching,
      );
      await env.DB
        .prepare(
          `UPDATE radar_profiles SET initialized = 1
           WHERE owner_username = ? AND platform = ?`,
        )
        .bind(row.owner_username, row.platform)
        .run();
    } else {
      const webhook =
        row.webhook_ciphertext && row.webhook_iv
          ? await decryptSecret(
              env,
              requestUrl,
              row.webhook_ciphertext,
              row.webhook_iv,
            )
          : "";
      if (!webhook) throw new Error("Webhook Discord nie jest skonfigurowany.");
      const fresh = await unseenOffers(
        env.DB,
        row.owner_username,
        row.platform,
        matching,
      );
      for (const offer of fresh.slice(0, 10)) {
        await sendDiscordOffer(webhook, config, offer);
        await rememberOffers(env.DB, row.owner_username, row.platform, [offer]);
        sent += 1;
      }
    }

    await recordRun(
      env.DB,
      row.owner_username,
      row.platform,
      offers.length,
      matching.length,
      sent,
      null,
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
): Promise<{
  fetched: number;
  matched: number;
  offers: PublicOffer[];
}> {
  const row = await getRadarRow(env.DB, username, platform);
  const config = publicConfig(row);
  const offers = await fetchOffers(row);
  const matching = offers.filter((offer) => matchesRadar(offer, config));
  return {
    fetched: offers.length,
    matched: matching.length,
    offers: matching.slice(0, 24).map(toPublicOffer),
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

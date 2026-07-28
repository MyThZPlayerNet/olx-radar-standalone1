import { decryptSecret } from "@/lib/crypto";
import type { DatabaseLike } from "@/lib/database";
import { sendDiscordOffer } from "@/lib/discord";
import {
  fetchOlxOffers,
  matchesRadar,
  toPublicOffer,
  type Offer,
} from "@/lib/olx";
import {
  ensureSchema,
  getRadarRow,
  publicConfig,
  publicStatus,
} from "@/lib/store";
import type { AppEnv } from "@/lib/runtime";
import type { PublicOffer, RadarRow, RadarStatus } from "@/lib/types";

export type CheckResult = RadarStatus & {
  offers: PublicOffer[];
  skipped?: boolean;
};

async function recordRun(
  db: DatabaseLike,
  username: string,
  fetched: number,
  matched: number,
  sent: number,
  error: string | null,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE radars SET
           last_check_at = CURRENT_TIMESTAMP,
           last_fetched = ?,
           last_matched = ?,
           last_sent = ?,
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE owner_username = ?`,
      )
      .bind(fetched, matched, sent, error, username),
    db
      .prepare(
        `INSERT INTO poll_runs (owner_username, fetched, matched, sent, error)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(username, fetched, matched, sent, error),
    db
      .prepare(
        `DELETE FROM poll_runs
         WHERE owner_username = ? AND id NOT IN (
           SELECT id FROM poll_runs WHERE owner_username = ? ORDER BY id DESC LIMIT 30
         )`,
      )
      .bind(username, username),
    db
      .prepare(
        "DELETE FROM seen_offers WHERE owner_username = ? AND seen_at < datetime('now', '-90 days')",
      )
      .bind(username),
  ]);
}

async function claimDueRadar(
  db: DatabaseLike,
  username: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE radars
       SET next_check_at = datetime('now', '+' || interval_seconds || ' seconds')
       WHERE owner_username = ?
         AND active = 1
         AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)`,
    )
    .bind(username)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

async function unseenOffers(
  db: DatabaseLike,
  username: string,
  offers: Offer[],
): Promise<Offer[]> {
  if (!offers.length) return [];
  const placeholders = offers.map(() => "?").join(",");
  const result = await db
    .prepare(
      `SELECT offer_id FROM seen_offers
       WHERE owner_username = ? AND offer_id IN (${placeholders})`,
    )
    .bind(username, ...offers.map((offer) => offer.id))
    .all<{ offer_id: string }>();
  const seen = new Set((result.results ?? []).map((row) => row.offer_id));
  return offers.filter((offer) => !seen.has(offer.id));
}

async function rememberOffers(
  db: DatabaseLike,
  username: string,
  offers: Offer[],
): Promise<void> {
  if (!offers.length) return;
  await db.batch(
    offers.map((offer) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO seen_offers (owner_username, offer_id) VALUES (?, ?)",
        )
        .bind(username, offer.id),
    ),
  );
}

async function processRadar(
  env: AppEnv,
  row: RadarRow,
  requestUrl: string,
): Promise<CheckResult> {
  const config = publicConfig(row);
  try {
    const offers = await fetchOlxOffers(config);
    const matching = offers.filter((offer) => matchesRadar(offer, config));
    let sent = 0;

    if (!row.initialized) {
      await rememberOffers(env.DB, row.owner_username, matching);
      await env.DB
        .prepare(
          "UPDATE radars SET initialized = 1 WHERE owner_username = ?",
        )
        .bind(row.owner_username)
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
      const fresh = await unseenOffers(env.DB, row.owner_username, matching);
      for (const offer of fresh.slice(0, 10)) {
        await sendDiscordOffer(webhook, config, offer);
        await rememberOffers(env.DB, row.owner_username, [offer]);
        sent += 1;
      }
    }
    await recordRun(
      env.DB,
      row.owner_username,
      offers.length,
      matching.length,
      sent,
      null,
    );
    return {
      ...publicStatus(await getRadarRow(env.DB, row.owner_username)),
      offers: matching.slice(0, 24).map(toPublicOffer),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się sprawdzić OLX.";
    await recordRun(env.DB, row.owner_username, 0, 0, 0, message);
    throw error;
  }
}

export async function runUserRadar(
  env: AppEnv,
  username: string,
  requestUrl: string,
): Promise<CheckResult> {
  await ensureSchema(env.DB);
  const claimed = await claimDueRadar(env.DB, username);
  if (!claimed) {
    const row = await getRadarRow(env.DB, username);
    return { ...publicStatus(row), offers: [], skipped: true };
  }
  return processRadar(env, await getRadarRow(env.DB, username), requestUrl);
}

export async function previewUserRadar(
  env: AppEnv,
  username: string,
): Promise<{
  fetched: number;
  matched: number;
  offers: PublicOffer[];
}> {
  const config = publicConfig(await getRadarRow(env.DB, username));
  const offers = await fetchOlxOffers(config);
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
      `SELECT * FROM radars
       WHERE active = 1
         AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)
       ORDER BY next_check_at ASC
       LIMIT 10`,
    )
    .all<RadarRow>();
  for (const row of result.results ?? []) {
    const claimed = await claimDueRadar(env.DB, row.owner_username);
    if (!claimed) continue;
    try {
      await processRadar(
        env,
        await getRadarRow(env.DB, row.owner_username),
        requestUrl,
      );
    } catch {
      // The failure is persisted per account; one radar must not block the rest.
    }
  }
}

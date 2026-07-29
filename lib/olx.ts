import type { Offer } from "@/lib/offers";
import type { RadarConfig } from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nestedName(data: UnknownRecord, key: string): string {
  return text(record(data[key]).name);
}

function paramValue(params: UnknownRecord, key: string): UnknownRecord {
  return record(record(params[key]).value);
}

function offerFromApi(item: UnknownRecord, promoted: boolean): Offer | null {
  const rawParams = Array.isArray(item.params) ? item.params : [];
  const params: UnknownRecord = {};
  for (const entry of rawParams) {
    const value = record(entry);
    const key = text(value.key);
    if (key) params[key] = value;
  }

  const priceData = paramValue(params, "price");
  const rawPrice = priceData.value;
  const price = typeof rawPrice === "number" ? rawPrice : null;
  const conditionData = paramValue(params, "state");
  const locationData = record(item.location);
  const city = nestedName(locationData, "city");
  const district = nestedName(locationData, "district");
  const region = nestedName(locationData, "region");
  const cityParts = [city, district].filter(Boolean).join(", ");
  const location = region
    ? cityParts
      ? `${cityParts} (${region})`
      : region
    : cityParts;

  const photos = Array.isArray(item.photos) ? item.photos : [];
  const imageLink = photos.length ? text(record(photos[0]).link) : "";
  const promotion = record(item.promotion);
  const paidPromotion = Boolean(
    promotion.top_ad ||
      promotion.highlighted ||
      promotion.urgent ||
      promotion.options,
  );

  const offer: Offer = {
    condition: text(conditionData.label),
    conditionKey: text(conditionData.key),
    createdAt: text(item.created_time),
    delivery: Boolean(record(record(item.delivery).rock).active),
    description: text(item.description),
    id: String(item.id ?? ""),
    imageUrl: imageLink
      .replace("{width}", "600")
      .replace("{height}", "450"),
    location,
    price,
    priceLabel: text(priceData.label),
    promoted: promoted || paidPromotion,
    sellerType: item.business ? "business" : "private",
    title: text(item.title),
    url: text(item.url),
  };
  return offer.id && offer.title && offer.url ? offer : null;
}

export async function fetchOlxOffers(config: RadarConfig): Promise<Offer[]> {
  const params = new URLSearchParams({
    filter_refiners: "spell_checker",
    limit: "40",
    offset: "0",
    query: config.query,
    sort_by: "created_at:desc",
    suggest_filters: "true",
  });
  if (config.categoryId > 0) {
    params.set("category_id", String(config.categoryId));
  }
  const response = await fetch(
    `https://www.olx.pl/api/v1/offers/?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; OLX-Radar/2.0)",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`OLX zwrócił błąd ${response.status}.`);
  }
  const payload = (await response.json()) as UnknownRecord;
  const data = Array.isArray(payload.data) ? payload.data : null;
  if (!data) throw new Error("OLX zwrócił odpowiedź bez listy ogłoszeń.");

  const promotedValues = record(record(payload.metadata).source).promoted;
  const promoted = new Set(
    Array.isArray(promotedValues)
      ? promotedValues.filter((value): value is number => typeof value === "number")
      : [],
  );
  return data
    .map((item, index) => offerFromApi(record(item), promoted.has(index)))
    .filter((offer): offer is Offer => offer !== null);
}

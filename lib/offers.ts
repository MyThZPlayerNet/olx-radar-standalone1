import type { PublicOffer, RadarConfig } from "@/lib/types";

export type Offer = PublicOffer & {
  conditionKey: string;
  description: string;
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function matchesRadar(offer: Offer, config: RadarConfig): boolean {
  const searchable = normalize(
    `${offer.title}\n${offer.description}\n${offer.condition}`,
  );
  const included = config.includeKeywords.map(normalize);
  if (
    included.length &&
    (config.matchAllKeywords
      ? !included.every((keyword) => searchable.includes(keyword))
      : !included.some((keyword) => searchable.includes(keyword)))
  ) {
    return false;
  }
  if (
    config.excludeKeywords
      .map(normalize)
      .some((keyword) => searchable.includes(keyword))
  ) {
    return false;
  }
  if (
    config.locations.length &&
    !config.locations
      .map(normalize)
      .some((location) => normalize(offer.location).includes(location))
  ) {
    return false;
  }
  if (
    config.conditions.length &&
    !config.conditions
      .map(normalize)
      .some((condition) =>
        [offer.condition, offer.conditionKey].map(normalize).includes(condition),
      )
  ) {
    return false;
  }
  if (config.sellerType !== "all" && offer.sellerType !== config.sellerType) {
    return false;
  }
  if (config.deliveryRequired && !offer.delivery) return false;
  if (config.skipPromoted && offer.promoted) return false;
  if (
    config.minPrice !== null &&
    (offer.price === null || offer.price < config.minPrice)
  ) {
    return false;
  }
  if (
    config.maxPrice !== null &&
    (offer.price === null || offer.price > config.maxPrice)
  ) {
    return false;
  }
  if (config.maxAgeMinutes > 0 && offer.createdAt) {
    const createdAt = Date.parse(offer.createdAt);
    if (
      Number.isNaN(createdAt) ||
      Date.now() - createdAt > config.maxAgeMinutes * 60_000
    ) {
      return false;
    }
  }
  return true;
}

export function toPublicOffer(offer: Offer): PublicOffer {
  const { conditionKey, description, ...result } = offer;
  void conditionKey;
  void description;
  return result;
}

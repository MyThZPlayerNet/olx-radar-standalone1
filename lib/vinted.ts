import type { Offer } from "@/lib/offers";
import type { RadarConfig } from "@/lib/types";

type UnknownRecord = Record<string, unknown>;

type VintedSession = {
  cookie: string;
  expiresAt: number;
  token: string;
};

const sessionGlobal = globalThis as typeof globalThis & {
  __vintedRadarSessions?: Map<string, VintedSession>;
};

const browserHeaders = {
  Accept: "application/json",
  "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.7",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getSetCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof extended.getSetCookie === "function") {
    return extended.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

async function createSession(hostname: string): Promise<VintedSession> {
  // The Polish storefront enables stricter bot protection more often. Public
  // storefront tokens are accepted by the catalog API across Vinted domains,
  // so rotate through stable official storefronts before the requested host.
  const candidates = [
    ...new Set([
      "www.vinted.com",
      "www.vinted.co.uk",
      "www.vinted.fr",
      hostname,
    ]),
  ];
  let lastStatus = 0;

  for (const sessionHost of candidates) {
    const response = await fetch(`https://${sessionHost}/`, {
      cache: "no-store",
      headers: {
        ...browserHeaders,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    lastStatus = response.status;
    if (!response.ok) continue;

    const cookies = new Map<string, string>();
    for (const header of getSetCookies(response.headers)) {
      const pair = header.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value) cookies.set(key, value);
    }

    const token = cookies.get("access_token_web") ?? "";
    if (!token) continue;
    return {
      cookie:
        sessionHost === hostname
          ? [...cookies].map(([key, value]) => `${key}=${value}`).join("; ")
          : "",
      expiresAt: Date.now() + 6 * 60 * 60_000,
      token,
    };
  }

  throw new Error(
    `Vinted nie udostępnił publicznej sesji${lastStatus ? ` (błąd ${lastStatus})` : ""}. Spróbuj ponownie później.`,
  );
}

async function sessionFor(hostname: string, refresh = false): Promise<VintedSession> {
  const sessions =
    sessionGlobal.__vintedRadarSessions ??
    (sessionGlobal.__vintedRadarSessions = new Map());
  const current = sessions.get(hostname);
  if (!refresh && current && current.expiresAt > Date.now()) return current;
  const next = await createSession(hostname);
  sessions.set(hostname, next);
  return next;
}

function apiUrl(config: RadarConfig): URL {
  const source = new URL(config.sourceUrl);
  const url = new URL(`https://${source.hostname}/api/v2/catalog/items`);
  source.searchParams.forEach((value, key) => {
    if (!["page", "per_page", "order"].includes(key)) {
      url.searchParams.append(key, value);
    }
  });
  url.searchParams.set("search_text", config.query);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "40");
  url.searchParams.set("order", "newest_first");
  return url;
}

async function catalogPayload(
  config: RadarConfig,
  retry = true,
): Promise<UnknownRecord> {
  const source = new URL(config.sourceUrl);
  const session = await sessionFor(source.hostname);
  const response = await fetch(apiUrl(config), {
    cache: "no-store",
    headers: {
      ...browserHeaders,
      Authorization: `Bearer ${session.token}`,
      Referer: config.sourceUrl,
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    },
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    await sessionFor(source.hostname, true);
    return catalogPayload(config, false);
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Vinted chwilowo ograniczył liczbę zapytań. Radar spróbuje ponownie przy następnym sprawdzeniu.",
      );
    }
    throw new Error(`Vinted zwrócił błąd ${response.status}.`);
  }
  const payload = (await response.json()) as unknown;
  return record(payload);
}

function priceLabel(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pl-PL", {
      currency: currency || "PLN",
      style: "currency",
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("pl-PL")} ${currency}`.trim();
  }
}

function offerFromApi(value: unknown): Offer | null {
  const item = record(value);
  const priceData = record(item.price);
  const amount = Number(priceData.amount);
  const price = Number.isFinite(amount) ? amount : null;
  const currency = text(priceData.currency_code) || "PLN";
  const user = record(item.user);
  const photo = record(item.photo);
  const photos = Array.isArray(item.photos) ? item.photos : [];
  const fallbackPhoto = photos.length ? record(photos[0]) : {};
  const condition = text(item.status);
  const brand = text(item.brand_title);
  const size = text(item.size_title);
  const seller = text(user.login);
  const url = text(item.url);
  const id = String(item.id ?? "");
  const title = text(item.title);

  if (!id || !title || !url) return null;
  return {
    condition,
    conditionKey: condition,
    createdAt: "",
    delivery: false,
    description: [
      brand && `Marka: ${brand}`,
      size && `Rozmiar: ${size}`,
      seller && `Sprzedający: @${seller}`,
    ]
      .filter(Boolean)
      .join("\n"),
    id,
    imageUrl: text(photo.url) || text(fallbackPhoto.url),
    location: "",
    price,
    priceLabel: price === null ? "" : priceLabel(price, currency),
    promoted: Boolean(item.promoted),
    sellerType: user.business ? "business" : "private",
    title,
    url,
  };
}

export async function fetchVintedOffers(config: RadarConfig): Promise<Offer[]> {
  const payload = await catalogPayload(config);
  const items = Array.isArray(payload.items) ? payload.items : null;
  if (!items) {
    throw new Error("Vinted zwrócił odpowiedź bez listy ogłoszeń.");
  }
  return items
    .map(offerFromApi)
    .filter((offer): offer is Offer => offer !== null);
}

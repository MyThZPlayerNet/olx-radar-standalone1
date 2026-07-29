import type { Offer } from "@/lib/offers";
import type { RadarConfig } from "@/lib/types";

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value: string, limit: number): string {
  const clean = value.trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trim()}…`;
}

async function postWebhook(webhookUrl: string, payload: unknown): Promise<void> {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Discord zwrócił błąd ${response.status}.`);
  }
}

export async function sendDiscordTest(
  webhookUrl: string,
  config: RadarConfig,
): Promise<void> {
  const platform = config.platform === "olx" ? "OLX" : "Vinted";
  await postWebhook(webhookUrl, {
    allowed_mentions: { parse: [] },
    avatar_url: config.discordAvatarUrl || undefined,
    embeds: [
      {
        color: config.discordColor,
        description:
          "Twoje konto jest połączone. Od teraz wybrane ogłoszenia mogą trafiać na ten kanał.",
        title: `${platform} Radar działa`,
      },
    ],
    username: config.discordUsername,
  });
}

export async function sendDiscordOffer(
  webhookUrl: string,
  config: RadarConfig,
  offer: Offer,
): Promise<void> {
  const platform = config.platform === "olx" ? "OLX" : "Vinted";
  const fields = [
    {
      inline: true,
      name: "Cena",
      value: truncate(offer.priceLabel || "Brak ceny", 1024),
    },
    {
      inline: true,
      name: "Sprzedający",
      value: offer.sellerType === "business" ? "Firma" : "Osoba prywatna",
    },
  ];
  if (offer.location) {
    fields.splice(1, 0, {
      inline: true,
      name: "Lokalizacja",
      value: truncate(offer.location, 1024),
    });
  }
  if (offer.condition) {
    fields.push({ inline: true, name: "Stan", value: offer.condition });
  }
  if (offer.delivery) {
    fields.push({
      inline: true,
      name: `Przesyłka ${platform}`,
      value: "Dostępna",
    });
  }
  const roleId = /^\d{5,30}$/.test(config.discordRoleId)
    ? config.discordRoleId
    : "";
  await postWebhook(webhookUrl, {
    allowed_mentions: roleId ? { parse: [], roles: [roleId] } : { parse: [] },
    avatar_url: config.discordAvatarUrl || undefined,
    content: roleId ? `<@&${roleId}>` : "",
    embeds: [
      {
        color: config.discordColor,
        description: truncate(plainText(offer.description), 700),
        fields,
        footer: { text: `${platform} • ID ${offer.id}` },
        image: offer.imageUrl ? { url: offer.imageUrl } : undefined,
        timestamp: offer.createdAt || undefined,
        title: truncate(offer.title, 256),
        url: offer.url,
      },
    ],
    username: config.discordUsername,
  });
}

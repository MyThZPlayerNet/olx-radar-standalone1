import { decryptSecret } from "@/lib/crypto";
import { sendDiscordTest } from "@/lib/discord";
import { HttpError } from "@/lib/errors";
import {
  assertPasswordChanged,
  assertSameOrigin,
  jsonError,
  requireApiAccount,
} from "@/lib/security";
import {
  encryptedWebhookForSearch,
  getRadarRow,
  platformFromUnknown,
  publicConfig,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    const payload = (await request.json()) as {
      platform?: unknown;
      searchId?: unknown;
    };
    const platform = platformFromUnknown(payload.platform);
    const row = await getRadarRow(env.DB, account.username, platform);
    const config = publicConfig(row);
    const searchId =
      typeof payload.searchId === "string"
        ? payload.searchId
        : config.searches[0]?.id;
    const search = config.searches.find((item) => item.id === searchId);
    if (!search) throw new HttpError(404, "Nie znaleziono wybranej zakładki.");
    const encrypted = encryptedWebhookForSearch(row, search.id);
    if (!encrypted) {
      throw new HttpError(
        400,
        `Najpierw zapisz webhook dla zakładki „${search.name}”.`,
      );
    }
    const webhook = await decryptSecret(
      env,
      request.url,
      encrypted.ciphertext,
      encrypted.iv,
    );
    await sendDiscordTest(webhook, {
      ...config,
      ...search,
      searches: [search],
    });
    return Response.json({
      message: `Wiadomość testowa dla „${search.name}” została wysłana na przypisany kanał.`,
    });
  } catch (error) {
    return jsonError(error);
  }
}

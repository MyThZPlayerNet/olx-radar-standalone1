import { decryptSecret } from "@/lib/crypto";
import { sendDiscordTest } from "@/lib/discord";
import { HttpError } from "@/lib/errors";
import {
  assertPasswordChanged,
  assertSameOrigin,
  jsonError,
  requireApiAccount,
} from "@/lib/security";
import { getRadarRow, publicConfig } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    const row = await getRadarRow(env.DB, account.username);
    if (!row.webhook_ciphertext || !row.webhook_iv) {
      throw new HttpError(400, "Najpierw zapisz webhook Discord.");
    }
    const webhook = await decryptSecret(
      env,
      request.url,
      row.webhook_ciphertext,
      row.webhook_iv,
    );
    await sendDiscordTest(webhook, publicConfig(row));
    return Response.json({
      message: "Wiadomość testowa została wysłana na Twój kanał.",
    });
  } catch (error) {
    return jsonError(error);
  }
}

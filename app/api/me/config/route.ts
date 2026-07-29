import {
  assertPasswordChanged,
  jsonError,
  assertSameOrigin,
  requireApiAccount,
} from "@/lib/security";
import {
  getRadarRows,
  platformFromUnknown,
  publicConfig,
  saveRadar,
} from "@/lib/store";
import type { ConfigInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { env, account } = await requireApiAccount(request);
    const rows = await getRadarRows(env.DB, account.username);
    return Response.json({
      account,
      configs: {
        olx: publicConfig(rows.olx),
        vinted: publicConfig(rows.vinted),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    const payload = (await request.json()) as ConfigInput;
    const platform = platformFromUnknown(payload.platform);
    const config = await saveRadar(
      env,
      account.username,
      platform,
      request.url,
      payload,
    );
    return Response.json({
      config,
      message: "Twoje ustawienia zostały bezpiecznie zapisane.",
    });
  } catch (error) {
    return jsonError(error);
  }
}

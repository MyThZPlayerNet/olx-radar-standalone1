import {
  assertPasswordChanged,
  jsonError,
  assertSameOrigin,
  requireApiAccount,
} from "@/lib/security";
import { getRadarRow, publicConfig, saveRadar } from "@/lib/store";
import type { ConfigInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { env, account } = await requireApiAccount(request);
    const config = publicConfig(await getRadarRow(env.DB, account.username));
    return Response.json({
      config,
      account,
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
    const config = await saveRadar(env, account.username, request.url, payload);
    return Response.json({
      config,
      message: "Twoje ustawienia zostały bezpiecznie zapisane.",
    });
  } catch (error) {
    return jsonError(error);
  }
}

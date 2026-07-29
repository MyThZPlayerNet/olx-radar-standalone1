import {
  assertPasswordChanged,
  assertSameOrigin,
  jsonError,
  requireApiAccount,
} from "@/lib/security";
import { platformFromUnknown, setRadarActive } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    const payload = (await request.json()) as {
      active?: unknown;
      platform?: unknown;
    };
    if (typeof payload.active !== "boolean") {
      return Response.json(
        { error: "Brakuje informacji, czy radar ma być aktywny." },
        { status: 400 },
      );
    }
    const platform = platformFromUnknown(payload.platform);
    const status = await setRadarActive(
      env.DB,
      account.username,
      platform,
      payload.active,
    );
    return Response.json({
      message: payload.active
        ? `Radar ${platform === "olx" ? "OLX" : "Vinted"} został uruchomiony.`
        : `Radar ${platform === "olx" ? "OLX" : "Vinted"} został zatrzymany.`,
      status,
    });
  } catch (error) {
    return jsonError(error);
  }
}

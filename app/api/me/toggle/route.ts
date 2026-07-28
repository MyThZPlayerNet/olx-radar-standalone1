import {
  assertPasswordChanged,
  assertSameOrigin,
  jsonError,
  requireApiAccount,
} from "@/lib/security";
import { setRadarActive } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    const payload = (await request.json()) as { active?: unknown };
    if (typeof payload.active !== "boolean") {
      return Response.json(
        { error: "Brakuje informacji, czy radar ma być aktywny." },
        { status: 400 },
      );
    }
    const status = await setRadarActive(
      env.DB,
      account.username,
      payload.active,
    );
    return Response.json({
      message: payload.active
        ? "Radar został uruchomiony."
        : "Radar został zatrzymany.",
      status,
    });
  } catch (error) {
    return jsonError(error);
  }
}

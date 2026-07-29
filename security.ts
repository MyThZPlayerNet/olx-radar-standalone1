import { previewUserRadar } from "@/lib/monitor";
import {
  assertPasswordChanged,
  assertSameOrigin,
  jsonError,
  requireApiAccount,
} from "@/lib/security";
import { platformFromUnknown } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    const payload = (await request.json()) as { platform?: unknown };
    return Response.json(
      await previewUserRadar(
        env,
        account.username,
        platformFromUnknown(payload.platform),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}

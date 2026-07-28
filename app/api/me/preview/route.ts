import { previewUserRadar } from "@/lib/monitor";
import {
  assertPasswordChanged,
  assertSameOrigin,
  jsonError,
  requireApiAccount,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { env, account } = await requireApiAccount(request);
    assertPasswordChanged(account);
    return Response.json(await previewUserRadar(env, account.username));
  } catch (error) {
    return jsonError(error);
  }
}

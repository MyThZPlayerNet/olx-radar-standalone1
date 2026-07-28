import { runUserRadar } from "@/lib/monitor";
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
    const result = await runUserRadar(env, account.username, request.url);
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
